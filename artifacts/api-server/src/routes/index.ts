import { Router, type IRouter } from "express";
import healthRouter from "./health";
import connectRouter from "./connect";

const router: IRouter = Router();

router.use(healthRouter);
router.use(connectRouter);

export default router;
