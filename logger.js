import 'dotenv/config';
import { Logtail } from '@logtail/node';

export const logtail = new Logtail(process.env.BETTERSTACK_SOURCE_TOKEN, {
  endpoint: `https://${process.env.BETTERSTACK_INGESTING_HOST}`,
});
