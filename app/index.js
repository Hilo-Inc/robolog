import express from 'express';
const app = express();
app.get('/', (_, res) => res.send('Hello from Node behind Nginx!'));
app.listen(3000, () => console.log('App listening on :3000'));
