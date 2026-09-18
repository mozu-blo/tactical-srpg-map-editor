# スマホ用SRPGマップエディタ v0.1

タクティクスSRPGのGameplay用マップを、`X / Zセル + Height` で設計する静的2.5Dエディタです。Windows PCのブラウザと、GitHub Pagesから開くiPhone Safari/PWAを対象にしています。

## 主な機能

- 自由サイズ（1〜64）のX/Zグリッド作成
- 0.5刻みのHeight配置・消去、セル色
- 侵入禁止、オブジェクトメモ、選択セル編集
- タップ編集、スワイプ連続編集、2本指カメラ、ピンチズーム
- X/Y/Z連続編集制限、Height変更ON/OFF
- 戻る・進む（1タップまたは1スワイプを1操作として記録）
- 真上、Pitch 42°のYaw 45/135/225/315、正面、右側面
- IndexedDB自動保存、名前付き保存、再読込
- JSON出力・読込、真上確認画像出力
- PWA、Service Worker、オフライン起動

完成3Dマップ、3D Asset配置、自由Voxel、戦闘シミュレーション、Unity/Blender出力はv0.1の対象外です。

## 操作

- **地形**：セルをタップしてHeightと色を編集します。
- **侵入禁止**：タップでON/OFF。赤い表示が侵入禁止です。
- **メモ／選択**：セルを選び、メニュー内の情報を編集します。
- **1本指**：タップ編集。連続編集ONではスワイプしたセルを連続編集します。Y方向連続編集OFFでは、開始セルから決めたHeightまでを一度だけ配置・消去します。
- **2本指**：ドラッグで視点変更、ピンチで拡大縮小します。
- **PC**：左クリックで編集、右ドラッグで視点変更、ホイールで拡大縮小します。

JSONの詳細は [JSON_SCHEMA.md](./JSON_SCHEMA.md) を参照してください。

## ローカル起動

Node.js 20以降で次を実行し、`http://127.0.0.1:4173` を開きます。

```text
node dev-server.mjs
```

テストは `node --test` で実行します。Backendやビルド工程はありません。

## GitHub Pages

このリポジトリはProject Pages配下でも動く相対パス構成です。`main` へのpush後、同梱のGitHub Actionsが静的ファイルをPagesへ公開します。Repository SettingsのPagesでSourceを **GitHub Actions** に設定してください。

## PWA

初回読込後はアプリ本体と保存済みMapをオフラインで利用できます。iPhoneではSafariの共有メニューから「ホーム画面に追加」を選びます。IndexedDBデータはブラウザ／サイト単位で保存されるため、重要なMapはJSONも出力してください。

## QA

自動テスト、PCブラウザ実操作、iPhone相当のレスポンシブ確認結果は [QA_REPORT.md](./QA_REPORT.md) に記録しています。iPhone実機の最終操作性はユーザー確認まで未PASSです。
