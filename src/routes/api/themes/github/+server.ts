import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface GitHubTheme {
  name: string;
  path: string;
  type: string;
  download_url?: string;
}

interface ThemeManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  preview: {
    thumbnail: string;
  };
  customProperties: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    [key: string]: string;
  };
  features: {
    glassmorphism: boolean;
    gradients: boolean;
    [key: string]: boolean;
  };
  fonts: {
    [key: string]: string;
  };
  animations: {
    [key: string]: string;
  };
  settings: {
    defaultAccentColor: string;
    defaultTheme: string;
  };
}

const GITHUB_REPO = 'sortedsh/desqta-themes'; // Replace with your actual repo
const GITHUB_TOKEN = ''; // Set this in your .env file as GITHUB_TOKEN=your_token

export const GET: RequestHandler = async () => {
  try {
    // Fetch repository contents from GitHub API
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          ...(GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {})
        }
      }
    );

    if (!response.ok) {
      console.warn(`GitHub repository ${GITHUB_REPO} not found or inaccessible. Status: ${response.status}`);
      
      // Return empty themes array instead of throwing error
      return json({
        success: true,
        themes: [],
        total: 0,
        message: `GitHub repository ${GITHUB_REPO} not found. Please create the repository or update the GITHUB_REPO constant.`
      });
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn('GitHub API returned non-JSON response:', contentType);
      return json({
        success: true,
        themes: [],
        total: 0,
        message: 'GitHub API returned invalid response format.'
      });
    }

    const contents: GitHubTheme[] = await response.json();
    
    // Filter for directories (themes)
    const themeDirectories = contents.filter(item => item.type === 'dir');
    
    // Fetch theme manifests for each directory
    const themePromises = themeDirectories.map(async (dir) => {
      try {
        const manifestResponse = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/contents/${dir.name}/manifest.json`,
          {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              ...(GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {})
            }
          }
        );

        if (!manifestResponse.ok) {
          console.warn(`No manifest found for theme: ${dir.name}`);
          return null;
        }

        const manifestData = await manifestResponse.json();
        
        // Decode the content (GitHub API returns base64 encoded content)
        const manifestContent = atob(manifestData.content);
        const manifest: ThemeManifest = JSON.parse(manifestContent);

        // Construct download URLs for theme assets
        const encodedDirName = encodeURIComponent(dir.name);
        const baseUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${encodedDirName}`;
        console.log('Theme directory:', dir.name, 'Base URL:', baseUrl);
        
        return {
          ...manifest,
          downloadUrl: baseUrl,
          thumbnailUrl: manifest.preview.thumbnail.startsWith('http') 
            ? manifest.preview.thumbnail 
            : `${baseUrl}/${manifest.preview.thumbnail}`,
          source: 'github',
          repository: GITHUB_REPO
        };
      } catch (error) {
        console.error(`Error fetching theme ${dir.name}:`, error);
        return null;
      }
    });

    const themes = await Promise.all(themePromises);
    const validThemes = themes.filter(theme => theme !== null);

    return json({
      success: true,
      themes: validThemes,
      total: validThemes.length
    });

  } catch (error) {
    console.error('Error fetching themes from GitHub:', error);
    return json({
      success: true,
      themes: [],
      total: 0,
      error: 'Failed to fetch themes from GitHub',
      message: 'Please check your internet connection and try again.'
    });
  }
}; 