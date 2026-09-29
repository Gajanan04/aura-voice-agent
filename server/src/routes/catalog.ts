import { Router } from 'express'
import { get_product_catalog } from '../tools/getProductCatalog.js'

export function createCatalogRouter(): Router {
  const router = Router()
  router.get('/', (_request, response) => response.json(get_product_catalog()))
  return router
}
