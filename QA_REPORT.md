# QA結果 v0.1

## 自動テスト

- X/Zセル生成、サイズ境界
- Height 0.5刻み、0未満防止
- JSON正規化、不正セル数拒否
- 侵入禁止・メモ保持
- 戻る・進む、変更なし操作の除外

## PCブラウザ

- 1280×720、Orthographic 3D Grid表示：PASS
- Height配置・消去、色、選択：PASS
- 侵入禁止表示、メモ編集：PASS
- 戻る・進む：PASS
- 戦闘視点4（Pitch 42° / Yaw 315°）：PASS
- IndexedDB名前付き保存・再読込：PASS
- JSON Export / Import：PASS
- 真上確認画像Export：PASS
- Service Worker停止後の再読込：PASS

## iPhone相当表示

- 390×844（iPhone相当）、16×16マップ全体表示：PASS
- メニュー展開／折りたたみ、折りたたみ後の全画面3D領域：PASS
- セルタップ編集：PASS
- スワイプ連続編集：PASS
- 1回の「戻る」で1スワイプ全体を復元：PASS
- 44px以上の主要操作部品と日本語UI：PASS
- ピンチ操作はComputer Use環境で実機同等入力を生成できないため、実機確認へ継続

## iPhone実機で確認が必要

- Safariでホーム画面へ追加後の起動
- 2本指カメラとピンチの実機感度
- 長いスワイプ連続編集の追従
- Safariのファイル選択・ダウンロード導線
- セーフエリアと端末回転

実機操作性はユーザー確認までPASS扱いにしません。
