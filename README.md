# TRACE / TYPE — Narrative Security Lab

## Episodes

教材は `data/missions.json` の `{ version, lab, episodes }` で管理します。version 2は20 episode・96 missionで構成され、EP1-4は基礎、EP5-10は中級、EP11-20は上級の調査教材です。EP1-4は各4件、EP5-20は各5件の連続missionを持ち、前のクイズに正解すると次が解放されます。v2進捗は `trace-v2-completed`、`trace-v2-misses`、`trace-v2-current` に保存します。

### 教材データの追加

`episodes` に `id`、`number`、`title`、`subtitle`、`briefing`、順序付きの `missions` を追加します。各episodeは4件以上のmissionを持ち、各missionは `id`、`order`、`title`、`goal`、`context`、`category`、`command`、`tokens`、`output`、`evidence`、`handoff`、`quiz` を持ちます。`quiz.answer` は `choices` の添字です。追加後は `npm test` とJSONの件数・ID・順序を確認し、出力先頭行とtoken順序も検証します。

実コマンド、外部ネットワーク、実在企業・ドメインは扱いません。読み取り・監査コマンドだけを教材化し、root権限取得、サービスの開始・停止・有効化、コンテナへの接続・変更・削除、ファイル破壊、外部通信は扱いません。架空ログから不審な設定や利用時刻を検知し、観測事実と未確定事項を分けて是正判断を学ぶ防御教材です。

IT初学者とセキュリティ職志望者向けの、解説付きサイバーセキュリティ・タイピングラボです。TYPE → UNDERSTAND → 教材内出力 → クイズの順で、安全なコマンドの考え方を学びます。

## 安全方針

静的サイトで、アカウント、API、外部ネットワーク、実コマンド実行はありません。`.test`ドメインとRFC5737の予約済みIP、JSON内の教材ログだけを使います。入力はブラウザ内で評価し、進捗とミス数はlocalStorageに保存します。

## 開発

`npm test` で教材スキーマ、進行ロジック、タイピングロジックをNode built-in testで検証できます。静的サーバーで `index.html` を開いてください（`fetch` を使うため `file://` よりHTTP配信を推奨）。Ctrl/⌘ Kまたは「移動」から、エピソードとミッションを検索できます。

進捗は `trace-v2-completed`（完了ID）、`trace-v2-misses`（ミス数）、`trace-v2-current`（現在ID）の3キーだけをlocalStorageで使用します。リセット時もこの3キーだけを削除します。

スポンサー枠はレッスン完了後だけ表示し、「広告 / アフィリエイト予定」と明示しています。実際の掲載・外部リンクは未実装です。
