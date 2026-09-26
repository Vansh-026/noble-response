/* eslint-disable */
// @ts-nocheck

import { Route as rootRouteImport } from "./routes/__root.jsx";
import { Route as IndexRouteImport } from "./routes/index.jsx";
import { Route as CThreadIdRouteImport } from "./routes/c.$threadId.jsx";

const IndexRoute = IndexRouteImport.update({
  id: "/",
  path: "/",
  getParentRoute: () => rootRouteImport,
});

const CThreadIdRoute = CThreadIdRouteImport.update({
  id: "/c/$threadId",
  path: "/c/$threadId",
  getParentRoute: () => rootRouteImport,
});

const rootRouteChildren = {
  IndexRoute: IndexRoute,
  CThreadIdRoute: CThreadIdRoute,
};

export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren);
