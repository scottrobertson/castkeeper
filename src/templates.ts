import type { StoredEpisode } from "./types";

export function formatDuration(seconds: number): string {
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

export function calculateProgress(playedTime: number, duration: number): number {
  return Math.round((playedTime / duration) * 100);
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

export function generateHistoryHtml(episodes: StoredEpisode[], totalEpisodes: number, password: string | null): string {
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
        <strong>Total Episodes:</strong> ${totalEpisodes}
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
