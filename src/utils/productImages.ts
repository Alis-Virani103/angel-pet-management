/** Exact product-to-photo assignments confirmed from the uploaded image content. */
export const PRODUCT_IMAGE_MAP: Record<string, string> = {
  'PRD-101': 'https://res.cloudinary.com/demo/image/upload/v1787762871/angel_pet_products/100ml_bottle_bzhwqh.jpg',
  'PRD-102': 'https://res.cloudinary.com/demo/image/upload/v1787762875/angel_pet_products/200ml_bottle_rgrym5.jpg',
  'PRD-103': 'https://res.cloudinary.com/demo/image/upload/v1787762878/angel_pet_products/250ml_bottle_wbtflb.jpg',
  'PRD-104': 'https://res.cloudinary.com/demo/image/upload/v1787762884/angel_pet_products/500ml_bottle_l0zor0.jpg',
  'PRD-105': 'https://res.cloudinary.com/demo/image/upload/v1787762865/angel_pet_products/1_litre_bottles_ucmpme.jpg',
  'PRD-107': 'https://res.cloudinary.com/demo/image/upload/v1787762895/angel_pet_products/5L_bottle_nwynxv.jpg',
  'PRD-109': 'https://res.cloudinary.com/demo/image/upload/v1787762863/angel_pet_products/1_litre_bliching_bottle_hshwy1.jpg',
  'PRD-110': 'https://res.cloudinary.com/demo/image/upload/v1787762866/angel_pet_products/1000ml_bottle_rhwu2h.jpg',
  'PRD-111': 'https://res.cloudinary.com/demo/image/upload/v1787762867/angel_pet_products/1000ml_cylindrical_jmapxr.jpg',
  'PRD-112': 'https://res.cloudinary.com/demo/image/upload/v1787762868/angel_pet_products/1000ml_finel_ofibqq.jpg',
  'PRD-113': 'https://res.cloudinary.com/demo/image/upload/v1787762869/angel_pet_products/1000ml_oil_bottle_ien9ex.jpg',
  'PRD-114': 'https://res.cloudinary.com/demo/image/upload/v1787762872/angel_pet_products/1100ml_bottle_rscuf8.jpg',
  'PRD-115': 'https://res.cloudinary.com/demo/image/upload/v1787762874/angel_pet_products/1500ml_bottle_jkweev.jpg',
  'PRD-116': 'https://res.cloudinary.com/demo/image/upload/v1787762876/angel_pet_products/200ml_soda_dgwsyr.jpg',
  'PRD-117': 'https://res.cloudinary.com/demo/image/upload/v1787762879/angel_pet_products/250ml_oil_bottle_j1evff.jpg',
  'PRD-118': 'https://res.cloudinary.com/demo/image/upload/v1787762880/angel_pet_products/400ml_bottle_tskwm1.jpg',
  'PRD-119': 'https://res.cloudinary.com/demo/image/upload/v1787762881/angel_pet_products/5_litre_hoshing_machine_liquid_bottle_mjrpin.jpg',
  'PRD-120': 'https://res.cloudinary.com/demo/image/upload/v1787762882/angel_pet_products/5_4.5_4_litre_xbqm28.jpg',
  'PRD-121': 'https://res.cloudinary.com/demo/image/upload/v1787762883/angel_pet_products/500ml_bambu_bottle_iu7mn2.jpg',
  'PRD-122': 'https://res.cloudinary.com/demo/image/upload/v1787762885/angel_pet_products/500ml_cylindrical_pypird.jpg',
  'PRD-123': 'https://res.cloudinary.com/demo/image/upload/v1787762886/angel_pet_products/500ml_hdpe_d7je2q.jpg',
  'PRD-124': 'https://res.cloudinary.com/demo/image/upload/v1787762887/angel_pet_products/500ml_oil_bottle_a4ph2b.jpg',
  'PRD-125': 'https://res.cloudinary.com/demo/image/upload/v1787762888/angel_pet_products/500ml_toilet_cleaner_khdpvz.jpg',
  'PRD-126': 'https://res.cloudinary.com/demo/image/upload/v1787762889/angel_pet_products/500ml_wokal_bottle_jnhent.jpg',
  'PRD-127': 'https://res.cloudinary.com/demo/image/upload/v1787762890/angel_pet_products/50ml_bottle_htnnol.jpg',
  'PRD-128': 'https://res.cloudinary.com/demo/image/upload/v1787762892/angel_pet_products/50ml_oil_bottle_ori5gr.jpg',
  'PRD-129': 'https://res.cloudinary.com/demo/image/upload/v1787762893/angel_pet_products/50ml_to_1_litre_HDPE_bottlr_l5defn.jpg',
  'PRD-130': 'https://res.cloudinary.com/demo/image/upload/v1787762895/angel_pet_products/5litre_hdpe_can_g90ao1.jpg',
  'PRD-131': 'https://res.cloudinary.com/demo/image/upload/v1787762897/angel_pet_products/700ml_surbat_huwbtc.jpg',
  'PRD-132': 'https://res.cloudinary.com/demo/image/upload/v1787762898/angel_pet_products/700ml_surbat2_nzpsno.jpg',
  'PRD-133': 'https://res.cloudinary.com/demo/image/upload/v1787762899/angel_pet_products/800ml_bottle_svkmxr.jpg',
  'PRD-207': 'https://res.cloudinary.com/demo/image/upload/v1787762900/angel_pet_products/All_caps_iwquy9.jpg',
  'PRD-134': 'https://res.cloudinary.com/demo/image/upload/v1787762901/angel_pet_products/No_name_be9avf.jpg',
  'PRD-135': 'https://res.cloudinary.com/demo/image/upload/v1787762902/angel_pet_products/no_name_2_dlqmxh.jpg',
  'PRD-136': 'https://res.cloudinary.com/demo/image/upload/v1787762903/angel_pet_products/no_name_3_oxjixt.jpg',
};

/** Every seeded product is classified so unmatched products never get a guessed image. */
export const PRODUCT_IMAGE_STATUS: Record<string, 'matched' | 'UNMATCHED'> = {
  'PRD-101': 'matched',
  'PRD-102': 'matched',
  'PRD-103': 'matched',
  'PRD-104': 'matched',
  'PRD-105': 'matched',
  'PRD-106': 'UNMATCHED',
  'PRD-107': 'matched',
  'PRD-109': 'matched',
  'PRD-110': 'matched',
  'PRD-111': 'matched',
  'PRD-112': 'matched',
  'PRD-113': 'matched',
  'PRD-114': 'matched',
  'PRD-115': 'matched',
  'PRD-116': 'matched',
  'PRD-117': 'matched',
  'PRD-118': 'matched',
  'PRD-119': 'matched',
  'PRD-120': 'matched',
  'PRD-121': 'matched',
  'PRD-122': 'matched',
  'PRD-123': 'matched',
  'PRD-124': 'matched',
  'PRD-125': 'matched',
  'PRD-126': 'matched',
  'PRD-127': 'matched',
  'PRD-128': 'matched',
  'PRD-129': 'matched',
  'PRD-130': 'matched',
  'PRD-131': 'matched',
  'PRD-132': 'matched',
  'PRD-133': 'matched',
  'PRD-207': 'matched',
  'PRD-134': 'matched',
  'PRD-135': 'matched',
  'PRD-136': 'matched',
  'PRD-108': 'UNMATCHED',
  'PRD-201': 'UNMATCHED',
  'PRD-202': 'UNMATCHED',
  'PRD-203': 'UNMATCHED',
  'PRD-204': 'UNMATCHED',
  'PRD-205': 'UNMATCHED',
  'PRD-206': 'UNMATCHED',
};

/**
 * Get product image URL for a given product object.
 * Returns custom imageUrl if explicitly defined on the product,
 * or resolves from SKU / Product Name map,
 * or returns undefined to show the professional placeholder.
 */
export function getProductImageUrl(product: {
  id?: string;
  sku?: string;
  name?: string;
  imageUrl?: string;
}): string | undefined {
  if (product.imageUrl && product.imageUrl.trim()) {
    return product.imageUrl;
  }
  if (product.id && PRODUCT_IMAGE_MAP[product.id]) {
    return PRODUCT_IMAGE_MAP[product.id];
  }
  return undefined;
}
