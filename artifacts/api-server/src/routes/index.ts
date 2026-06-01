import { Router, type IRouter } from "express";
import healthRouter from "./health";
import connectRouter from "./connect";
import legalRouter from "./legal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(connectRouter);
router.use(legalRouter);

export default router;
