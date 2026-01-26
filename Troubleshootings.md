# Troubleshootings

## ERROR  Error: Cannot find module 'babel-preset-expo'

Neste caso, instale a lib com, pois há um conflito de versões:

```bash
npm install --save-dev babel-preset-expo --legacy-peer-deps
```
