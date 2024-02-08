import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import {randomUUID} from 'crypto'
import { redis } from "../../lib/radis";
import { voting } from "../../utils/voting-pub-sub";

export async function voteOnPollRoute(app: FastifyInstance){
    app.post('/polls/:pollId/votes', async (req, reply) => {
        const voteOnPollBody = z.object({
            pollOptionId: z.string().uuid(),
        });

        const voteOnPollParams = z.object({
            pollId: z.string().uuid(),
        });
    
        const { pollOptionId } = voteOnPollBody.parse(req.body);
        const { pollId } = voteOnPollParams.parse(req.params);

        let { sessionId } = req.cookies;

        if(sessionId){
            const userPreviousVoteOnPoll = await prisma.vote.findUnique({
                where: {
                    sessionId_pollId: {
                        sessionId,
                        pollId
                    }
                }
            });

            if(userPreviousVoteOnPoll && userPreviousVoteOnPoll.pollOptionId !== pollOptionId){
                // Se o usuário já votou nessa enquete mas em outra opção

                // Apagar o voto anterior e criar um novo
                await prisma.vote.delete({
                    where: {
                        id: userPreviousVoteOnPoll.id
                    }
                })

                // Reduz a pontuação da opção antiga
                const votes = await redis.zincrby(pollId, -1, userPreviousVoteOnPoll.pollOptionId);

                // Envia a nova pontuação da opção para o usuário conectado na rota 'results'
                voting.publish(pollId, {
                    pollOptionId: userPreviousVoteOnPoll.pollOptionId,
                    votes: Number(votes)
                })
            } else if(userPreviousVoteOnPoll) {
                // Se ele já votou nessa enquete e nessa mesma opção
                return reply.status(400).send({message: 'Você já votou nessa enquete!'})
            }
            
        }

        if(!sessionId){
            sessionId = randomUUID();
        
            reply.setCookie('sessionId', sessionId, {
                path: '/', //Todas as rotas podem acessar o cookie
                maxAge: 60 * 60 * 24 * 30, //Por quanto tempo essa informação ficará disponível (um mês)
                signed: true, //O usuário não irá conseguir modificar manualmente o valor desse cookie
                httpOnly: true //faz com que o cookie só seja acessível pelo backend da aplicação
            });
        }
    
        await prisma.vote.create({
            data: {
                sessionId,
                pollId,
                pollOptionId
            }
        })

        // Incrementa a pontuação da opção selecionada
        const votes = await redis.zincrby(pollId, 1, pollOptionId);

        // Envia a nova pontuação da opção para o usuário conectado na rota 'results'
        voting.publish(pollId, {
            pollOptionId,
            votes: Number(votes)
        })

        return reply.status(201).send();
    })
}