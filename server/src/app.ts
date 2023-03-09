import Express, { RequestHandler, ErrorRequestHandler } from 'express'
import cors from 'cors'
import { ExpressError, NotFoundError } from './helpers/ExpressError';

export const app = Express();

//Set up middleware
app.use(cors());
app.use(Express.json());

/**Handle 404 errors. */
/*
app.use(function (req: Request, res: Response, next: NextFunction) {
  return next(new NotFoundError());
});
*/

app.use(((req, res, next) => {
  return next(new NotFoundError());
}) as RequestHandler)

/**Generic error handler. */
app.use(((err, req, res, next) => {
  if (process.env.NODE_ENV !== "test") console.error(err.stack);

  const status = err.status || 500;
  const message = err.message;

  return res.status(status).json({
    error: { message, status },
  });
}) as ErrorRequestHandler)