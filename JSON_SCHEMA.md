# Gameplay Map JSON仕様 v0.1

JSONはマップ設計の機械可読な正本候補です。文字コードはUTF-8、座標は `x` と `z`、高さは `height` で表します。

## ルート

| フィールド | 型 | 内容 |
|---|---|---|
| `schemaVersion` | number | v0.1では `1` |
| `mapName` | string | マップ名 |
| `width` | integer | X方向のセル数（1〜64） |
| `depth` | integer | Z方向のセル数（1〜64） |
| `cells` | array | `width × depth` 件のセル |

## セル

| フィールド | 型 | 内容 |
|---|---|---|
| `x` | integer | 0始まりのX座標 |
| `z` | integer | 0始まりのZ座標 |
| `height` | number | 0以上、0.5刻み |
| `color` | string | `#RRGGBB` 形式の表示色 |
| `impassable` | boolean | `true` は侵入禁止 |
| `memo` | string | オブジェクトや配置意図のメモ（最大500文字） |

地下・空中Voxelや3D Asset情報は含みません。読込時はセル数、座標範囲、色形式を検証し、Heightを0.5刻みに正規化します。
