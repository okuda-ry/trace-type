# TRACE / TYPE — Narrative Security Lab

## Episodes

教材は `data/missions.json` の `{ version, lab, episodes }` で管理します。version 2は20 episode・96 missionで構成され、EP1-4は基礎、EP5-10は中級、EP11-20は上級の調査教材です。EP1-4は各4件、EP5-20は各5件の連続missionを持ち、前のクイズに正解すると次が解放されます。v2進捗は `trace-v2-completed`、`trace-v2-misses`、`trace-v2-current` に保存します。折りたたみ状態は `trace-v2-mission-panel-collapsed` に保存します。

### 教材データの追加

`episodes` に `id`、`number`、`title`、`subtitle`、`briefing`、順序付きの `missions` を追加します。各episodeは4件以上のmissionを持ち、各missionは `id`、`order`、`title`、`goal`、`context`、`category`、`command`、`tokens`、`output`、`evidence`、`handoff`、`quiz` を持ちます。`quiz.answer` は `choices` の添字です。追加後は `npm test` とJSONの件数・ID・順序を確認し、出力先頭行とtoken順序も検証します。

教材内では実コマンド、外部ネットワーク、実在企業・ドメインを扱いません。読み取り・監査コマンドだけを教材化し、root権限取得、サービスの開始・停止・有効化、コンテナへの接続・変更・削除、ファイル破壊、外部通信は扱いません。架空ログから不審な設定や利用時刻を検知し、観測事実と未確定事項を分けて是正判断を学ぶ防御教材です。

IT初学者とセキュリティ職志望者向けの、解説付きサイバーセキュリティ・タイピングラボです。TYPE → UNDERSTAND → 教材内出力 → クイズの順で、安全なコマンドの考え方を学びます。

## 安全方針

静的サイトで、アカウント、API、教材機能からの外部データ送信、実コマンド実行はありません。`.test`ドメインとRFC5737の予約済みIP、JSON内の教材ログだけを使います。入力はブラウザ内で評価し、進捗とミス数はlocalStorageに保存します。表示フォントのためCSSからGoogle Fontsを参照するため、公開時のプライバシー通知にはこの通信も記載します。

## 開発

`npm test` で教材スキーマ、進行ロジック、タイピングロジックをNode built-in testで検証できます。`npm run build` はCloudflare Pagesに渡す静的ファイルを `dist/` に生成します。静的サーバーで `index.html` を開いてください（`fetch` を使うため `file://` よりHTTP配信を推奨）。Ctrl/⌘ Kまたは「移動」から、エピソードとミッションを検索できます。

進捗は `trace-v2-completed`（完了ID）、`trace-v2-misses`（ミス数）、`trace-v2-current`（現在ID）、`trace-v2-mission-panel-collapsed`（表示設定）をlocalStorageで使用します。全進捗リセット時は前者3つだけを削除し、表示設定は保持します。

WPMはキーボード入力の経過時間だけを表示し、貼り付けや自動入力では `—` と表示します。

スポンサー枠はレッスン完了後だけ表示し、「広告 / アフィリエイト」と明示しています。A8.net経由の楽天市場商品リンク（Linux・ハッキング関連の参考書）を掲載しています。価格・在庫はリンク先を優先し、リンク経由で購入されると運営者に報酬が入る場合があります。広告・プライバシー通知は [privacy.html](privacy.html) に公開しています。

現時点ではプログラマティック広告ネットワークを使っていないため、`ads.txt` は配置していません。別の表示広告を導入する場合は、広告事業者の指定に従って `ads.txt` と同意管理を追加します。

## Cloudflare Pages公開

Cloudflare PagesではFramework presetを使わず、Build commandを `npm test && npm run build`、Build output directoryを `dist` に設定します。`dist/404.html` と `dist/_headers` もビルドに含まれます。ドメイン確定後に `robots.txt` のSitemap URL、canonical、OGP、サイトマップを追加し、プレビューURLで表示・キーボード操作・狭い画面幅を確認してから本番ドメインを接続します。

安全方針は [safety.html](safety.html)、広告・プライバシー通知は [privacy.html](privacy.html) に公開しています。`ui-concepts/` は公開対象から除外しています。LICENSEファイルは追加していません。
