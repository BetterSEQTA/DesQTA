import type { ThemeManifest } from './themeService';

export interface GitHubTheme extends ThemeManifest {
  downloadUrl: string;
  thumbnailUrl: string;
  source: 'github';
  repository: string;
}

export interface GitHubThemesResponse {
  success: boolean;
  themes: GitHubTheme[];
  total: number;
  error?: string;
}

export class GitHubThemeService {
  private static instance: GitHubThemeService;
  
  private constructor() {}
  
  static getInstance(): GitHubThemeService {
    if (!GitHubThemeService.instance) {
      GitHubThemeService.instance = new GitHubThemeService();
    }
    return GitHubThemeService.instance;
  }

  async fetchThemesFromGitHub(): Promise<GitHubThemesResponse> {
    try {
      const response = await fetch('/api/themes/github');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch themes: ${response.status}`);
      }
      
      const data: GitHubThemesResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching themes from GitHub:', error);
      return {
        success: false,
        themes: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async downloadTheme(theme: GitHubTheme): Promise<ThemeManifest | null> {
    try {
      // Fetch the theme's manifest.json from the GitHub raw URL
      const manifestUrl = `${theme.downloadUrl}/manifest.json`;
      console.log('Downloading theme manifest from:', manifestUrl);
      const response = await fetch(manifestUrl);
      
      if (!response.ok) {
        console.error(`Failed to download theme manifest: ${response.status} - ${response.statusText}`);
        throw new Error(`Failed to download theme manifest: ${response.status}`);
      }
      
      const manifest: ThemeManifest = await response.json();
      return manifest;
    } catch (error) {
      console.error('Error downloading theme:', error);
      return null;
    }
  }

  async downloadThemeAssets(theme: GitHubTheme): Promise<{ css?: string; assets?: Record<string, string> } | null> {
    try {
      // Fetch the theme's CSS file
      const cssUrl = `${theme.downloadUrl}/theme.css`;
      const cssResponse = await fetch(cssUrl);
      
      let css: string | undefined;
      if (cssResponse.ok) {
        css = await cssResponse.text();
      }

      // You could also fetch other assets here if needed
      const assets: Record<string, string> = {};
      
      return { css, assets };
    } catch (error) {
      console.error('Error downloading theme assets:', error);
      return null;
    }
  }
}

export const githubThemeService = GitHubThemeService.getInstance(); 