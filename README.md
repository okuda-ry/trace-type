# TRACE / TYPE — Narrative Security Lab

## Episodes

教材は `data/missions.json` の `{ version, lab, episodes }` で管理します。各episodeは4つの連続missionを持ち、前のクイズに正解すると次が解放されます。v2進捗は `trace-v2-completed`、`trace-v2-misses`、`trace-v2-current` に保存します。

### 教材データの追加

`episodes` に episode を追加し、その中へ順序付きの `missions` を4件以上登録します。各missionは `id`、`title`、`goal`、`context`、`category`、`command`、`tokens`、`output`、`evidence`、`handoff`、`quiz` を持ちます。`quiz.answer` は `choices` の添字です。現在は4 episode × 4 missionで、基礎調査、権限監査、DNS調査、ログ分析を一続きのケースとして扱います。

実コマンド、外部ネットワーク、実在企業・ドメインは扱いません。root権限の取得は行わず、架空ログから不審な委任設定や利用時刻を検知し、是正判断を学ぶ防御教材です。

IT初学者とセキュリティ職志望者向けの、解説付きサイバーセキュリティ・タイピングラボです。TYPE → UNDERSTAND → 教材内出力 → クイズの順で、安全なコマンドの考え方を学びます。

## 安全方針

初期版は静的サイトです。アカウント、API、外部ネットワーク、実コマンド実行はありません。`example.test` とRFC5737の予約済みIP、JSON内の教材ログだけを使います。入力はブラウザ内で評価し、進捗とミス数はlocalStorageに保存します。

## 開発

`npm test` で教材スキーマ、進行ロジック、タイピングロジックをNode built-in testで検証できます。静的サーバーで `index.html` を開いてください（`fetch` を使うため `file://` よりHTTP配信を推奨）。Ctrl/⌘ Kまたは「移動」から、エピソードとミッションを検索できます。

進捗は `trace-v2-completed`（完了ID）、`trace-v2-misses`（ミス数）、`trace-v2-current`（現在ID）の3キーだけをlocalStorageで使用します。リセット時もこの3キーだけを削除します。

スポンサー枠はレッスン完了後だけ表示し、「広告 / アフィリエイト予定」と明示しています。実際の掲載・外部リンクは未実装です。
