import { createHash, timingSafeEqual } from 'node:crypto';
import { record, validate, formatOrderNumber } from '../nobel/origens/os/model.js';

const restoreScript = `
local items = cjson.decode(ARGV[1])
for _, item in ipairs(items) do
  local current = redis.call('HGET', KEYS[1], item.number)
  local version = 0
  if current then version = cjson.decode(current).version end
  if version ~= item.version - 1 then return 0 end
end
for _, item in ipairs(items) do
  redis.call('HSET', KEYS[1], item.number, cjson.encode(item))
end
return 1`;

const saveScript = `
local current = redis.call('HGET', KEYS[1], ARGV[1])
local version = 0
if current then version = cjson.decode(current).version end
if version ~= tonumber(ARGV[2]) then return 0 end
if ARGV[1] ~= ARGV[4] then
  if not current then return 0 end
  if redis.call('HEXISTS', KEYS[1], ARGV[4]) == 1 then return -1 end
  redis.call('HDEL', KEYS[1], ARGV[1])
end
redis.call('HSET', KEYS[1], ARGV[4], ARGV[3])
return 1`;

const deleteScript = `
local current = redis.call('HGET', KEYS[1], ARGV[1])
if not current then return 0 end
if cjson.decode(current).version ~= tonumber(ARGV[2]) then return 0 end
redis.call('HDEL', KEYS[1], ARGV[1])
return 1`;

export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  const { UPSTASH_REDIS_REST_URL:url, UPSTASH_REDIS_REST_TOKEN:token, OS_TEAM_PASSWORD:password } = process.env;
  const flags = [url,token,password].filter(Boolean).length;
  if (flags && flags !== 3) return res.status(503).json({error:'Complete as três variáveis da fila compartilhada na Vercel.'});
  if (req.method === 'GET' && req.query.mode === '1') return res.json({shared:flags === 3});
  if (!flags) return res.status(503).json({error:'Fila compartilhada desativada.'});
  const digest = value => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(req.headers.authorization || ''),digest('Bearer '+password))) return res.status(401).json({error:'Informe a senha da equipe.'});
  async function redis(command) {
    const result = await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command)});
    const body = await result.json();
    if (!result.ok || body.error) throw Error();
    return body.result;
  }
  try {
    const key = 'os-maneger:orders:v1';
    if (req.method === 'GET') return res.json((await redis(['HVALS',key])).map(value=>JSON.parse(value)));
    if (req.method === 'DELETE') {
      const input=req.body;
      if(!input || typeof input.number!=='string' || !/^\d{4}-\d{6}$/.test(input.number) || !Number.isSafeInteger(input.version) || input.version<1)
        return res.status(400).json({error:'OS inválida para exclusão.'});
      const deleted=await redis(['EVAL',deleteScript,1,key,input.number,input.version]);
      if(!deleted)return res.status(409).json({error:'A OS mudou ou foi excluída. Atualize a fila antes de excluir.'});
      return res.json({deleted:input.number});
    }
    if (req.method !== 'POST') return res.status(405).json({error:'Método indisponível.'});
    const input = req.body;
    if (req.query.restore === '1') {
      if (!Array.isArray(input) || input.length > 5000 || new Set(input.map(o=>o?.number)).size !== input.length ||
          input.some(o=>validate(o) || !Number.isSafeInteger(o.version) || o.version < 0)) {
        return res.status(400).json({error:'Backup inválido.'});
      }
      const saved = await redis(['EVAL',restoreScript,1,key,JSON.stringify(input.map(record))]);
      if (!saved) return res.status(409).json({error:'A fila mudou. Reabra o backup para revisar.'});
      return res.json({restored:input.length});
    }
    const error = validate(input);
    if (error || !Number.isSafeInteger(input.version) || input.version < 0) return res.status(400).json({error:error || 'Versão inválida.'});
    const order = record(input);
    const original=input.originalNumber ? formatOrderNumber(input.originalNumber) : order.number;
    if(typeof original!=='string' || !/^\d{4}-\d{6}$/.test(original))return res.status(400).json({error:'Número original inválido.'});
    const saved = await redis(['EVAL',saveScript,1,key,original,input.version,JSON.stringify(order),order.number]);
    if (saved===-1) return res.status(409).json({error:'Já existe uma OS com esse número. Escolha outro número.'});
    if (!saved) return res.status(409).json({error:'Número já cadastrado ou registro atualizado. Consulte a OS na fila.'});
    return res.json(order);
  } catch { return res.status(503).json({error:'Banco indisponível. Tente novamente.'}); }
}
