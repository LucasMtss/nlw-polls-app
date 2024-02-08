import fastify from 'fastify'
import cookie from '@fastify/cookie'
import { createPollRoute } from './routes/create-poll-route';
import { getPollRoute } from './routes/get-poll-route';
import { voteOnPollRoute } from './routes/vote-on-poll-route';
import fastifyWebsocket from '@fastify/websocket';
import { pollResults } from './ws/poll-results';

const app = fastify();

app.register(cookie, {
    secret: 'polls-app-nlw',
    hook: 'onRequest',
});

app.register(fastifyWebsocket);

app.register(createPollRoute);
app.register(getPollRoute);
app.register(voteOnPollRoute);
app.register(pollResults);

app.listen({port: 3333}).then(() => {
    console.log('HTTP server running!');
});