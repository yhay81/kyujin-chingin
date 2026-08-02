# Product metrics

35日保持の匿名イベントから、次を確認します。

- `users`: QAを除く利用者
- `searchers`: 検索した利用者
- `successful_searches` / `no_result_searches`: 結果あり・0件の操作回数
- `region_changers` / `sort_changers`: 地域・並び順を使った利用者
- `filter_changers`: 産業、雇用区分、受理地・就業地を変更した利用者
- `comparers`: 比較へ追加した利用者
- `copiers`: 比較結果をコピーした利用者

検索語、地域、産業、雇用区分、集計基準、賃金はイベントに含めません。自動QAは`is_qa=1`として実利用から除外します。

```powershell
npm run metrics
```
