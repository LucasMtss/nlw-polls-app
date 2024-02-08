import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/radis";

export async function getPollRoute(app: FastifyInstance){
    app.get('/polls/:pollId', async (req, reply) => {
        const getPollParams = z.object({
            pollId: z.string().uuid(),
        });
    
        const { pollId } = getPollParams.parse(req.params);
    
        const poll = await prisma.poll.findUnique({
           where: {
            id: pollId
           },
           include: {
            options: {
                select: {
                    id: true,
                    title: true
                }
            }
           }
        })

        if(!poll) return reply.status(400).send({message: 'Enquete não encontrada!'});

        // Obtém o ranking através de uma chave
        // o parâmetro 0 indica a posição inicial
        // o parâmetro -1 indica a posição final (-1 indica que são todas as opções)
        // WITHSCORE traz as opções com sua pontuação
        const result = await redis.zrange(pollId, 0, -1, 'WITHSCORES');

        const votes = result.reduce((obj, line, index) => {
            if(index % 2 === 0){
                const score = result[index + 1];
                Object.assign(obj, {[line]: Number(score)})
            }

            return obj;
        }, {} as Record<string, number>)
    
        return reply.send({
            poll: {...poll, options: poll.options.map(option => {
                return {...option, score: (option.id in votes) ? votes[option.id] : 0}
            })}
        });
    })
}