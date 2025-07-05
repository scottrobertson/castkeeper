/// <reference types="@cloudflare/workers-types" />

import { login } from "./login";
import { getListenHistory } from "./history";
import { saveHistory, initDatabase, getEpisodes } from "./db";
import type { Env, BackupResult, ExportedHandler, StoredEpisode } from "./types";

const worker: ExportedHandler<Env> = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case "/backup":
        return handleBackup(env);
      case "/history":
        return handleHistory(request, env);
      case "/export":
        return handleExport(request, env);
      default:
        return new Response("Pocketcasts Backup Worker", { status: 200 });
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleBackup(env));
  },
};

export default worker;

async function handleBackup(env: Env): Promise<Response> {
  try {
    validateEnvironment(env);
    await initDatabase(env.DB);

    const token = await login(env.EMAIL, env.PASS);
    const history = await getListenHistory(token);
    const savedHistory = await saveHistory(env.DB, history);

    const response: BackupResult = {
      success: true,
      message: "History saved successfully",
      synced: history.episodes.length,
      total: savedHistory.total,
    };

    return createJsonResponse(response);
  } catch (error) {
    console.error("Backup failed:", error);
    return createErrorResponse(error);
  }
}

async function handleHistory(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const password = url.searchParams.get("password");

  if (!isAuthorized(password, env.PASS)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const episodes = await getEpisodes(env.DB, 100);
    const html = generateHistoryHtml(episodes, password);
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("History failed:", error);
    return new Response("Error loading history", { status: 500 });
  }
}

async function handleExport(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const password = url.searchParams.get("password");

  if (!isAuthorized(password, env.PASS)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const episodes = await getEpisodes(env.DB);
    const csv = generateCsv(episodes);
    
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="pocketcasts-history-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export failed:", error);
    return new Response("Error exporting data", { status: 500 });
  }
}

// Utility functions
function validateEnvironment(env: Env): void {
  if (!env.EMAIL || !env.PASS) {
    throw new Error("EMAIL and PASS environment variables are required");
  }
}

function isAuthorized(password: string | null, expectedPassword: string): boolean {
  return password === expectedPassword;
}

function createJsonResponse(data: BackupResult): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}

function createErrorResponse(error: unknown): Response {
  const errorResponse: BackupResult = {
    success: false,
    error: error instanceof Error ? error.message : "Unknown error",
  };

  return new Response(JSON.stringify(errorResponse), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function calculateProgress(playedTime: number, duration: number): number {
  return Math.round((playedTime / duration) * 100);
}

function escapeCsvField(field: string | number | null): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCsv(episodes: StoredEpisode[]): string {
  const headers = [
    'Episode Title',
    'Podcast Title',
    'Duration (seconds)',
    'Played Up To (seconds)',
    'Progress (%)',
    'Published Date',
    'Episode Type',
    'Season',
    'Episode Number',
    'Author',
    'Starred',
    'Deleted'
  ];

  const csvRows = [headers.join(',')];
  
  episodes.forEach(episode => {
    const progress = calculateProgress(episode.played_up_to, episode.duration);
    const row = [
      escapeCsvField(episode.title),
      escapeCsvField(episode.podcast_title),
      episode.duration,
      episode.played_up_to,
      progress,
      escapeCsvField(episode.published),
      escapeCsvField(episode.episode_type),
      episode.episode_season || '',
      episode.episode_number || '',
      escapeCsvField(episode.author),
      episode.starred ? 'Yes' : 'No',
      episode.is_deleted ? 'Yes' : 'No'
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

function generateHistoryHtml(episodes: StoredEpisode[], password: string | null): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Pocketcasts Listen History</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .episode { 
            border: 1px solid #ddd; 
            margin: 10px 0; 
            padding: 15px; 
            border-radius: 5px; 
        }
        .title { font-weight: bold; font-size: 1.1em; }
        .podcast { color: #666; margin: 5px 0; }
        .meta { color: #999; font-size: 0.9em; }
        .progress { 
            background: #f0f0f0; 
            height: 5px; 
            border-radius: 3px; 
            margin: 5px 0; 
        }
        .progress-bar { 
            background: #4CAF50; 
            height: 100%; 
            border-radius: 3px; 
        }
        .stats { 
            background: #f5f5f5; 
            padding: 10px; 
            border-radius: 5px; 
            margin-bottom: 20px; 
        }
        .export-link {
            background: #007cba;
            color: white;
            padding: 8px 16px;
            text-decoration: none;
            border-radius: 4px;
            font-size: 0.9em;
            margin-left: 10px;
        }
        .export-link:hover {
            background: #005a87;
        }
        .backup-button {
            background: #28a745;
            color: white;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            font-size: 0.9em;
            margin-left: 10px;
            cursor: pointer;
        }
        .backup-button:hover {
            background: #218838;
        }
        .backup-button:disabled {
            background: #6c757d;
            cursor: not-allowed;
        }
        .backup-status {
            display: inline-block;
            margin-left: 10px;
            font-size: 0.9em;
        }
        .backup-status.success {
            color: #28a745;
        }
        .backup-status.error {
            color: #dc3545;
        }
    </style>
</head>
<body>
    <h1>Pocketcasts Listen History</h1>
    <div class="stats">
        <strong>Total Episodes:</strong> ${episodes.length}
        <button class="backup-button" onclick="runBackup()">Backup Now</button>
        <a href="/export?password=${encodeURIComponent(password || '')}" class="export-link">Download CSV</a>
        <span id="backup-status" class="backup-status"></span>
    </div>
    ${episodes.map(episode => generateEpisodeHtml(episode)).join('')}
    
    <script>
        async function runBackup() {
            const button = document.querySelector('.backup-button');
            const status = document.getElementById('backup-status');
            
            button.disabled = true;
            button.textContent = 'Running...';
            status.textContent = '';
            status.className = 'backup-status';
            
            try {
                const response = await fetch('/backup');
                const result = await response.json();
                
                if (result.success) {
                    status.innerHTML = '&#x2713; Synced ' + result.synced + ' episodes';
                    status.className = 'backup-status success';
                    
                    // Refresh page after successful backup to show new episodes
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else {
                    status.innerHTML = '&#x2717; Error: ' + result.error;
                    status.className = 'backup-status error';
                }
            } catch (error) {
                status.innerHTML = '&#x2717; Backup failed';
                status.className = 'backup-status error';
            }
            
            button.disabled = false;
            button.textContent = 'Backup Now';
        }
    </script>
</body>
</html>`;
}

function generateEpisodeHtml(episode: StoredEpisode): string {
  const progress = calculateProgress(episode.played_up_to, episode.duration);
  const publishedDate = new Date(episode.published).toLocaleDateString();

  return `
    <div class="episode">
        <div class="title">${episode.title}</div>
        <div class="podcast">${episode.podcast_title}</div>
        <div class="meta">
            Duration: ${formatDuration(episode.duration)} | 
            Played: ${formatDuration(episode.played_up_to)} | 
            Progress: ${progress}%
        </div>
        <div class="progress">
            <div class="progress-bar" style="width: ${progress}%"></div>
        </div>
        <div class="meta">Published: ${publishedDate}</div>
    </div>`;
}
