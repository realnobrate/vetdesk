import { Router, type IRouter } from "express";
import healthRouter from "./health";
import staffRouter from "./staff";
import ownersRouter from "./owners";
import petsRouter from "./pets";
import visitsRouter from "./visits";
import recallsRouter from "./recalls";
import appointmentsRouter from "./appointments";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(staffRouter);
router.use(ownersRouter);
router.use(petsRouter);
router.use(visitsRouter);
router.use(recallsRouter);
router.use(appointmentsRouter);
router.use(dashboardRouter);

export default router;
