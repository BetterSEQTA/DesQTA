use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Mutex, time::{Duration, Instant}};
use once_cell::sync::Lazy;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Article {
    pub title: Option<String>,
    pub description: Option<String>,
    pub url: Option<String>,
    #[serde(rename = "urlToImage")]
    pub url_to_image: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewsApiResponse {
    pub status: Option<String>,
    #[serde(rename = "totalResults")]
    pub total_results: Option<u32>,
    pub articles: Option<Vec<Article>>,
    pub code: Option<String>,
    pub message: Option<String>,
}

#[derive(Clone)]
struct CacheItem {
    inserted: Instant,
    data: NewsApiResponse,
}

static NEWS_CACHE: Lazy<Mutex<HashMap<String, CacheItem>>> = Lazy::new(|| Mutex::new(HashMap::new()));

fn cache_key(from: &str, domains: &str) -> String {
    format!("from={}|domains={}", from, domains)
}

const CACHE_TTL: Duration = Duration::from_secs(60); // 1 minute TTL; adjust as desired
const MAX_RATE_LIMIT_CACHEBUST_RETRIES: usize = 2; // mimic TS behavior but cap attempts

#[tauri::command]
pub async fn get_news_australia(from: String, domains: String) -> Result<NewsApiResponse, String> {
    // Check cache first to avoid duplicate requests within TTL
    let key = cache_key(&from, &domains);
    if let Some(cached) = NEWS_CACHE.lock().ok().and_then(|m| m.get(&key).cloned()) {
        if cached.inserted.elapsed() <= CACHE_TTL {
            return Ok(cached.data);
        }
    }

    let api_key = "17c0da766ba347c89d094449504e3080";
    let base_url = format!(
        "https://newsapi.org/v2/everything?domains={}&from={}&apiKey={}",
        urlencoding::encode(&domains),
        urlencoding::encode(&from),
        api_key
    );

    let client = reqwest::Client::new();

    async fn do_request(client: &reqwest::Client, url: &str) -> Result<(reqwest::StatusCode, String), String> {
        let resp = client.get(url).send().await.map_err(|e| format!("request error: {}", e))?;
        let status = resp.status();
        let text = resp.text().await.map_err(|e| format!("read body error: {}", e))?;
        Ok((status, text))
    }

    // perform request, with up to N cache-busting retries if body says rateLimited
    let mut url = base_url.clone();
    let mut attempts = 0usize;
    loop {
        let (status, text) = do_request(&client, &url).await?;
        let parsed: Result<NewsApiResponse, _> = serde_json::from_str(&text);
        match parsed {
            Ok(data) => {
                // If explicit rate limit in body or HTTP 429, try cache-busting like TS code
                let is_rate_limited = data.status.as_deref() == Some("error") && data.code.as_deref() == Some("rateLimited") || status.as_u16() == 429;
                if is_rate_limited {
                    if attempts < MAX_RATE_LIMIT_CACHEBUST_RETRIES {
                        attempts += 1;
                        url.push_str("%00");
                        continue; // retry with cache-busted URL
                    } else {
                        return Err(format!("rate_limited: {}", data.message.unwrap_or_else(|| "You have made too many requests recently. Try again later.".to_string())));
                    }
                }

                // Success path: cache and return
                if let Ok(mut map) = NEWS_CACHE.lock() {
                    map.insert(key, CacheItem { inserted: Instant::now(), data: data.clone() });
                }
                return Ok(data);
            }
            Err(e) => {
                return Err(format!("parse error: {} | body: {}", e, text));
            }
        }
    }
}
