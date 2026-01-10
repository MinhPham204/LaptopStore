const notificationService = require("../services/notificationService");
const {
  sequelize,
  Product,
  ProductVariation,
  ProductImage,
  Category,
  Brand,
  Tag,
  Order,
  OrderItem,
  Question,
  Answer,
  User,
  Role,
} = require("../models");
const { Op, Sequelize } = require("sequelize");
const axios = require("axios");
const BASE = process.env.RECO_API_BASE || "http://127.0.0.1:8000";
const TIMEOUT = +(process.env.RECO_TIMEOUT_MS || 7000);

// helper: nhận string CSV, array, hoặc single → trả về mảng số
const parseIdList = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((x) => Number(x)).filter(Boolean);
  return String(input)
    .split(",")
    .map((x) => Number(x.trim()))
    .filter(Boolean);
};

const parseStringList = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((x) => String(x).trim()).filter(Boolean);
  return String(input)
    .split(",")
    .map((x) => String(x).trim())
    .filter(Boolean);
};

exports.getProductFacets = async (req, res, next) => {
  try {
    const distinctVariationField = async (field) => {
      const rows = await ProductVariation.findAll({
        attributes: [[Sequelize.fn("DISTINCT", Sequelize.col(field)), "value"]],
        where: {
          [Op.and]: [
            Sequelize.where(Sequelize.col(field), { [Op.ne]: null }),
            Sequelize.where(Sequelize.col(field), { [Op.ne]: "" }),
          ],
        },
        raw: true,
      });
      return rows
        .map((r) => r.value)
        .filter(Boolean)
        .map((v) => String(v))
        .sort((a, b) => a.localeCompare(b));
    };

    const [processors, rams, storages, gpus, screens] = await Promise.all([
      distinctVariationField("processor"),
      distinctVariationField("ram"),
      distinctVariationField("storage"),
      distinctVariationField("graphics_card"),
      distinctVariationField("screen_size"),
    ]);

    let weights = [];
    try {
      const [rows] = await sequelize.query(
        `SELECT DISTINCT (specs->>'weight') AS value
         FROM products
         WHERE specs ? 'weight'
           AND (specs->>'weight') IS NOT NULL
           AND (specs->>'weight') <> ''
         LIMIT 200;`
      );
      weights = (rows || [])
        .map((r) => r.value)
        .filter(Boolean)
        .map((v) => String(v))
        .sort((a, b) => a.localeCompare(b));
    } catch (_) {
      weights = [];
    }

    res.json({
      facets: {
        processor: processors,
        ram: rams,
        storage: storages,
        graphics_card: gpus,
        screen_size: screens,
        weight: weights,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getProductsV2 = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page ?? 1));
    const limit = Math.max(1, Number.parseInt(req.query.limit ?? 12));
    const offset = (page - 1) * limit;

    const categoryIds = parseIdList(req.query.category_id || req.query["category_id[]"]);
    const brandIds = parseIdList(req.query.brand_id || req.query["brand_id[]"]);

    const minPrice = req.query.min_price != null ? Number(req.query.min_price) : undefined;
    const maxPrice = req.query.max_price != null ? Number(req.query.max_price) : undefined;

    const processors = parseStringList(req.query.processor || req.query.cpu);
    const rams = parseStringList(req.query.ram);
    const storages = parseStringList(req.query.storage || req.query.ssd);
    const gpus = parseStringList(req.query.graphics_card || req.query.gpu);
    const screens = parseStringList(req.query.screen_size || req.query.screenSize);

    const minWeight = req.query.min_weight != null ? Number(req.query.min_weight) : undefined;
    const maxWeight = req.query.max_weight != null ? Number(req.query.max_weight) : undefined;

    const search = (req.query.search || "").trim();
    const sortBy = String(req.query.sort_by ?? req.query.sortBy ?? "")
      .trim()
      .toLowerCase();

    const where = {};
    if (categoryIds.length === 1) where.category_id = categoryIds[0];
    else if (categoryIds.length > 1) where.category_id = { [Op.in]: categoryIds };

    if (brandIds.length === 1) where.brand_id = brandIds[0];
    else if (brandIds.length > 1) where.brand_id = { [Op.in]: brandIds };

    if (search) where.product_name = { [Op.iLike]: `%${search}%` };

    if (minPrice != null || maxPrice != null) {
      where.base_price = {};
      if (minPrice != null) where.base_price[Op.gte] = minPrice;
      if (maxPrice != null) where.base_price[Op.lte] = maxPrice;
    }

    if (minWeight != null || maxWeight != null) {
      const weightExpr = Sequelize.literal(
        `NULLIF(REGEXP_REPLACE("Product"."specs"->>'weight','[^0-9\\.]','','g'),'')::numeric`
      );
      const ands = where[Op.and] ? [...where[Op.and]] : [];
      if (minWeight != null) ands.push(Sequelize.where(weightExpr, { [Op.gte]: minWeight }));
      if (maxWeight != null) ands.push(Sequelize.where(weightExpr, { [Op.lte]: maxWeight }));
      if (ands.length) where[Op.and] = ands;
    }

    const variationWhere = {};
    if (processors.length) variationWhere.processor = { [Op.in]: processors };
    if (rams.length) variationWhere.ram = { [Op.in]: rams };
    if (storages.length) variationWhere.storage = { [Op.in]: storages };
    if (gpus.length) variationWhere.graphics_card = { [Op.in]: gpus };
    if (screens.length) variationWhere.screen_size = { [Op.in]: screens };

    const soldQtyExpr = Sequelize.literal(
      `(
        SELECT COALESCE(SUM(oi.quantity), 0)
        FROM order_items oi
        JOIN orders o ON o.order_id = oi.order_id
        JOIN product_variations pv ON pv.variation_id = oi.variation_id
        WHERE pv.product_id = "Product"."product_id"
          AND o.status IN ('confirmed','processing','shipping','delivered','PAID')
      )`
    );

    const attributes = sortBy === "best_selling" ? { include: [[soldQtyExpr, "sold_qty"]] } : undefined;
    const orderClause = (() => {
      if (sortBy === "price_asc") return [["base_price", "ASC"]];
      if (sortBy === "price_desc") return [["base_price", "DESC"]];
      if (sortBy === "newest") return [["created_at", "DESC"]];
      if (sortBy === "best_selling") return [[Sequelize.literal('"sold_qty"'), "DESC"], ["created_at", "DESC"]];
      return [["created_at", "DESC"]];
    })();

    const { count, rows } = await Product.findAndCountAll({
      where,
      attributes,
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["category_id", "category_name", "slug"],
        },
        {
          model: Brand,
          as: "brand",
          attributes: ["brand_id", "brand_name", "slug", "logo_url"],
        },
        {
          model: ProductVariation,
          as: "variations",
          attributes: ["variation_id", "price", "stock_quantity", "is_primary", "processor", "ram", "storage", "graphics_card", "screen_size"],
          ...(Object.keys(variationWhere).length
            ? { where: variationWhere, required: true }
            : {}),
        },
        {
          model: ProductImage,
          as: "images",
          where: { is_primary: true },
          required: false,
          attributes: ["image_url"],
        },
      ],
      limit,
      offset,
      order: orderClause,
      distinct: true,
    });

    res.json({
      products: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
      total: count,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    next(error);
  }
};
// Get all products with filters
exports.getProducts = async (req, res, next) => {
  try {
    // Ép kiểu và giá trị mặc định cho phân trang và sắp xếp
    const page = Math.max(1, Number.parseInt(req.query.page ?? 1));
    const limit = Math.max(1, Number.parseInt(req.query.limit ?? 12)); 
    const offset = (page - 1) * limit;

    // Whitelist sort/order để chống SQL Injection
    const allowedSort = new Set([
      "created_at",
      "base_price",
      "rating_average",
      "view_count",
      "product_name",
    ]);
    const allowedOrder = new Set(["ASC", "DESC"]);
    const sort = allowedSort.has(req.query.sort)
      ? req.query.sort
      : "created_at";
    const order = allowedOrder.has((req.query.order ?? "").toUpperCase())
      ? req.query.order.toUpperCase()
      : "DESC";

    // Lấy các tham số lọc
    const categoryIds = parseIdList(
      req.query.category_id || req.query["category_id[]"]
    );
    const brandIds = parseIdList(req.query.brand_id || req.query["brand_id[]"]);

    const minPrice =
      req.query.min_price != null ? Number(req.query.min_price) : undefined;
    const maxPrice =
      req.query.max_price != null ? Number(req.query.max_price) : undefined;

    // ĐỌC THAM SỐ TÌM KIẾM TỪ HEADER (search query)
    const search = (req.query.search || "").trim();

    const where = { is_active: true };

    // Lọc theo Danh mục
    if (categoryIds.length === 1) where.category_id = categoryIds[0];
    else if (categoryIds.length > 1)
      where.category_id = { [Op.in]: categoryIds };

    // Lọc theo Thương hiệu
    if (brandIds.length === 1) where.brand_id = brandIds[0];
    else if (brandIds.length > 1) where.brand_id = { [Op.in]: brandIds };

    // LỌC THEO TỪ KHÓA TÌM KIẾM
    if (search) {
      // Sử dụng Op.iLike (case-insensitive LIKE cho PostgreSQL) để tìm kiếm
      where.product_name = { [Op.iLike]: `%${search}%` };
    }

    // Lọc theo khoảng giá
    if (minPrice != null || maxPrice != null) {
      where.base_price = {};
      if (minPrice != null) where.base_price[Op.gte] = minPrice;
      if (maxPrice != null) where.base_price[Op.lte] = maxPrice;
    }

    const { count, rows } = await Product.findAndCountAll({
      where, // Áp dụng tất cả các điều kiện lọc (bao gồm tìm kiếm)
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["category_id", "category_name", "slug"],
        },
        {
          model: Brand,
          as: "brand",
          attributes: ["brand_id", "brand_name", "slug", "logo_url"],
        },
        {
          model: ProductVariation,
          as: "variations",
          attributes: ["variation_id", "price", "stock_quantity"],
        },
        {
          model: ProductImage,
          as: "images",
          where: { is_primary: true },
          required: false,
          attributes: ["image_url"],
        },
      ],
      limit,
      offset,
      order: [[sort, order]],
      distinct: true,
    });

    res.json({
      products: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
      total: count,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    next(error);
  }
};

exports.getProductDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const whereKey = isNaN(Number(id)) ? { slug: id } : { product_id: id };

    const product = await Product.findOne({
      where: { ...whereKey },
      attributes: { include: ["specs", "is_active"] },

      include: [
        { model: Category, as: "category" },
        { model: Brand, as: "brand" },

        // ✔ variations: chọn các cột cần thiết + sắp xếp hợp lý
        {
          model: ProductVariation,
          as: "variations",
          required: false,
          // Nếu muốn chỉ trả về cấu hình còn bán, bật dòng dưới:
          // where: { is_available: true },
          attributes: [
            "variation_id",
            "price",
            "stock_quantity",
            "is_available",
            "is_primary",
            "processor",
            "ram",
            "storage",
            "graphics_card",
            "screen_size",
            "color",
          ],
        },

        // Ảnh: lấy theo thứ tự display_order
        {
          model: ProductImage,
          as: "images",
        },

        { model: Tag, through: { attributes: [] } },
        // trong include: [...]
        {
          model: Question,
          as: "questions",
          attributes: [
            "question_id",
            "question_text",
            "is_answered",
            "created_at",
            "parent_question_id",
          ],
          where: { parent_question_id: null }, 
          required: false,
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_id", "username", "full_name"],
            },
            {
              model: Answer,
              as: "answers",
              attributes: ["answer_id", "answer_text", "created_at"],
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["user_id", "username", "full_name"],
                },
              ],
            },
            {
              model: Question, 
              as: "children",
              attributes: [
                "question_id",
                "question_text",
                "is_answered",
                "created_at",
                "parent_question_id",
              ],
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["user_id", "username", "full_name"],
                },
                {
                  model: Answer,
                  as: "answers",
                  attributes: ["answer_id", "answer_text", "created_at"],
                  include: [
                    {
                      model: User,
                      as: "user",
                      attributes: ["user_id", "username", "full_name"],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],

      // ✔ sắp xếp: ảnh theo display_order, hỏi đáp theo thời gian,
      //   variations mình sẽ sort ở FE theo is_primary/stock/price nếu muốn
      order: [
        [{ model: ProductImage, as: "images" }, "display_order", "ASC"],
        [{ model: Question, as: "questions" }, "created_at", "DESC"], // gốc mới trước
        // câu trả lời của gốc
        [
          { model: Question, as: "questions" },
          { model: Answer, as: "answers" },
          "created_at",
          "ASC",
        ],
        // follow-up: cũ trước (thường chỉ 1)
        [
          { model: Question, as: "questions" },
          { model: Question, as: "children" },
          "created_at",
          "ASC",
        ],
        // trả lời của follow-up
        [
          { model: Question, as: "questions" },
          { model: Question, as: "children" },
          { model: Answer, as: "answers" },
          "created_at",
          "ASC",
        ],
      ],
    });

    if (!product) return res.status(404).json({ message: "Product not found" });

    // Tăng view count (best-effort)
    product.increment("view_count").catch(() => {});

    // Chuẩn hóa JSON trả ra
    const json = product.toJSON();
    if (json.specs == null) json.specs = {};

    // ✔ Phòng trường hợp subquery không tìm được primaryVariationId
    if (!json.primaryVariationId && Array.isArray(json.variations) && json.variations.length) {
      const sorted = [...json.variations].sort((a, b) => {
        // is_primary DESC, stock DESC, price ASC
        if (+b.is_primary !== +a.is_primary) return (+b.is_primary) - (+a.is_primary);
        if ((b.stock_quantity ?? 0) !== (a.stock_quantity ?? 0)) return (b.stock_quantity ?? 0) - (a.stock_quantity ?? 0);
        return (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER);
      });
      json.primaryVariationId = sorted[0]?.variation_id;
    }

    return res.json({ product: json });
  } catch (error) {
    next(error);
  }
};

exports.getSearchSuggestions = async (req, res, next) => {
  try {
    const search = (req.query.q || "").trim();
    if (search.length < 2) {
      return res.json({ products: [] });
    }

    const products = await Product.findAll({
      where: {
        is_active: true,
        product_name: { [Op.iLike]: `%${search}%` },
      },
      attributes: [
        "product_id",
        "product_name",
        "slug",
        "thumbnail_url",
        "base_price",
        "discount_percentage",
      ],
      include: [
        {
          model: ProductVariation,
          as: "variations",
          attributes: ["price"],
          limit: 1, // Lấy variation đầu tiên để tính giá
        },
        {
          model: ProductImage,
          as: "images",
          where: { is_primary: true },
          required: false,
          attributes: ["image_url"],
        },
      ],
      limit: 5, // Chỉ giới hạn 5 kết quả gợi ý
    });

    res.json({ products });
  } catch (error) {
    next(error);
  }
};

// Get recommended products
// exports.getRecommendedProducts = async (req, res, next) => {
//   try {
//     const { product_id } = req.params;
//     const { limit = 4 } = req.query;

//     const currentProduct = await Product.findByPk(product_id);
//     if (!currentProduct) {
//       return res.status(404).json({ message: "Product not found" });
//     }

//     // Get products from same category or brand
//     const products = await Product.findAll({
//       where: {
//         product_id: { [Op.ne]: product_id },
//         is_active: true,
//         [Op.or]: [
//           { category_id: currentProduct.category_id },
//           { brand_id: currentProduct.brand_id },
//         ],
//       },
//       include: [
//         {
//           model: Category,
//           as: "category",
//           attributes: ["category_id", "category_name"],
//         },
//         {
//           model: Brand,
//           as: "brand",
//           attributes: ["brand_id", "brand_name", "logo_url"],
//         },
//         // ĐÃ SỬA: BẮT BUỘC INCLUDE VARIATIONS VÀ IMAGES
//         {
//           model: ProductVariation,
//           as: "variations",
//           attributes: [
//             "variation_id",
//             "price",
//             "stock_quantity",
//           ],
//           limit: 1,
//         },
//         {
//           model: ProductImage,
//           as: "images",
//           where: { is_primary: true },
//           required: false,
//           attributes: ["image_url"],
//         },
//       ],
//       limit: Number.parseInt(limit),
//       order: [
//         ["rating_average", "DESC"],
//         ["view_count", "DESC"],
//       ],
//     });

//     res.json({ products });
//   } catch (error) {
//     next(error);
//   }
// };

// Get recommend
async function fetchProductMeta(productIds = []) {
  if (!productIds.length) return {};

  const rows = await Product.findAll({
    where: { product_id: { [Op.in]: productIds } },
    attributes: [
      "product_id",
      // đổi "product_name" thành "name" nếu model của bạn map field -> name
      "product_name",
      "slug",
      "rating_average",
      "thumbnail_url",
    ],
    include: [
      {
        model: ProductImage,
        as: "images",
        required: false,
        attributes: ["image_url", "is_primary", "display_order"],
      },
    ],
    order: [
      [{ model: ProductImage, as: "images" }, "is_primary", "DESC"],
      [{ model: ProductImage, as: "images" }, "display_order", "ASC"],
    ],
  });

  const map = {};
  for (const r of rows) {
    const j = r.toJSON();
    const img = j.images?.[0];
    map[j.product_id] = {
      product_name: j.product_name,              // hoặc j.name nếu model đặt alias
      slug: j.slug,
      thumbnail_url: j.thumbnail_url || null,    // ← ưu tiên thumbnail_url từ products
      image: j.thumbnail_url || img?.image_url || null, // fallback sang ảnh primary
      rating_average: j.rating_average || null,
    };
  }
  return map;
}

exports.getRecommendedByVariation = async (req, res) => {
  const variationId = Number(req.params.variation_id);
  if (!variationId) return res.status(400).json({ products: [], error: "invalid variation_id" });

  try {
    const resp = await axios.get(`${BASE}/recommend`, {
      params: { variation_id: variationId },
      timeout: TIMEOUT,
      validateStatus: () => true, // nhận cả 4xx/5xx để đọc body
    });

    if (resp.status >= 400) {
      return res.status(502).json({
        products: [],
        basedOn: { variationId },
        source: "knn",
        error: `upstream_${resp.status}`,
        upstream: resp.data,
      });
    }

    const payload = resp.data;

    // ---- HỖ TRỢ NHIỀU KIỂU SHAPE ----
    // 1) Chuẩn: { items: [...] }
    // 2) Debug mode bạn đang có: { debug: [...] }
    // 3) Hiếm gặp: payload là một mảng luôn
    let raw = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.debug)
      ? payload.debug
      : Array.isArray(payload)
      ? payload
      : [];

    // (tuỳ chọn) Gộp trùng theo product_id → giữ biến thể có score cao nhất
    // score mặc định lấy performance_score nếu có, rơi về 0
    const bestByProduct = new Map();
    for (const it of raw) {
      const pid = it.product_id ?? it.id;
      const score =
        it.score ??
        it.performance_score ??
        it.rank_score ??
        0;

      const prev = bestByProduct.get(pid);
      if (!prev || score > prev._score) {
        bestByProduct.set(pid, { ...it, _score: score });
      }
    }
    raw = Array.from(bestByProduct.values());

    // Lấy meta từ DB cho các product_id (ảnh, slug, name)
    const productIds = raw.map((x) => x.product_id).filter(Boolean);
    const metaMap = await fetchProductMeta(productIds);

    // Map về shape FE cần
    const products = raw.map((it) => {
      const meta = metaMap[it.product_id] || {};
      return {
        id: it.product_id,                    // FE card link theo product
        variation_id: it.variation_id,        // để deep-link ?v= nếu muốn
        name: meta.product_name || it.product_name,   // ưu tiên DB -> rơi về từ Flask
        image: meta.thumbnail_url,                    // ưu tiên ảnh DB (ổn định)
        slug: meta.slug,
        price: it.price,
        score: it.score ?? it.performance_score ?? null,
        rating_average: meta.rating_average,
        // (tuỳ) thêm nguồn giải thích:
        explain: {
          source: it.source,                  // "fresh" / "indexed"
          score_source: it.score_source,      // "fresh:benchmark", ...
          cpu_source: it.cpu_source,
          gpu_source: it.gpu_source,
        },
      };
    });

    // Sắp xếp theo score giảm dần (nếu có)
    products.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

    return res.json({
      products,
      basedOn: { variationId },
      generated_at: payload.generated_at || new Date().toISOString(),
      source: "knn",
    });
  } catch (e) {
    console.error("getRecommendedByVariation EX:", e);
    return res.status(502).json({
      products: [],
      basedOn: { variationId },
      source: "knn",
      error: "adapter_exception",
      detail: { message: e.message, code: e.code, base: BASE },
    });
  }
};

// Get all categories
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      order: [["display_order", "ASC"]],
    });

    res.json({ categories });
  } catch (error) {
    next(error);
  }
};

// Get all brands
exports.getBrands = async (req, res, next) => {
  try {
    const brands = await Brand.findAll({
      order: [["brand_name", "ASC"]],
    });

    res.json({ brands });
  } catch (error) {
    next(error);
  }
};

// Tạo câu hỏi
// === TẠO CÂU HỎI (SỬA: dùng req.user.user_id) ===
// exports.createQuestion = async (req, res, next) => {
//   try {
//     const { id } = req.params; // product_id hoặc slug
//     const { question_text, parent_question_id } = req.body;

//     if (!question_text || !question_text.trim()) {
//       return res.status(400).json({ message: "question_text is required" });
//     }

//     const whereKey = /^\d+$/.test(String(id))
//       ? { product_id: id }
//       : { slug: id };
//     const product = await Product.findOne({
//       where: whereKey,
//       attributes: ["product_id", "product_name"], // Lấy thêm product_name để dùng trong thông báo
//     });
//     if (!product) return res.status(404).json({ message: "Product not found" });

//     let parent = null;
//     if (parent_question_id) {
//       parent = await Question.findByPk(parent_question_id, {
//         attributes: ["question_id", "product_id", "parent_question_id"],
//       });
//       if (!parent) {
//         return res.status(404).json({ message: "Parent question not found" });
//       }
//       // parent phải là câu gốc
//       if (parent.parent_question_id) {
//         return res
//           .status(400)
//           .json({ message: "Only one follow-up level is allowed" });
//       }
//       // cùng sản phẩm
//       if (parent.product_id !== product.product_id) {
//         return res
//           .status(400)
//           .json({ message: "Parent question does not belong to this product" });
//       }
//       // parent đã được trả lời bởi admin?
//       const answered = await Answer.findOne({
//         where: { question_id: parent.question_id },
//       });
//       if (!answered) {
//         return res
//           .status(400)
//           .json({ message: "Parent must be answered before follow-up" });
//       }
//     }

//     // Tạo mới
//     const q = await Question.create({
//       product_id: product.product_id,
//       user_id: req.user.user_id,
//       question_text: question_text.trim(),
//       is_answered: false,
//       parent_question_id: parent_question_id || null,
//     });

//     // Trả về kèm user
//     const withUser = await Question.findByPk(q.question_id, {
//       attributes: [
//         "question_id",
//         "question_text",
//         "is_answered",
//         "created_at",
//         "parent_question_id",
//       ],
//       include: [
//         {
//           model: User,
//           as: "user",
//           attributes: ["user_id", "username", "full_name"],
//         },
//       ],
//     });

//     // --- TÍCH HỢP THÔNG BÁO ---
//     const notifMessage = parent_question_id 
//       ? `Khách hàng phản hồi câu trả lời tại sản phẩm: ${product.product_name}`
//       : `Có câu hỏi mới về sản phẩm: ${product.product_name}`;

//     // Không cần await để không chặn response
//     notificationService.createNotification({
//       userId: null, // Gửi cho Admin
//       title: parent_question_id ? "Phản hồi mới 💬" : "Câu hỏi mới ❓",
//       message: notifMessage,
//       type: "new_question",
//       relatedType: "product",
//       relatedId: product.product_id
//     });
//     // ---------------------------

//     return res.status(201).json({ question: withUser });
//   } catch (err) {
//     // Nếu vi phạm unique (đã có follow-up cho parent), báo 409
//     if (err?.name === "SequelizeUniqueConstraintError") {
//       return res
//         .status(409)
//         .json({ message: "This question already has a follow-up" });
//     }
//     next(err);
//   }
// };

exports.createQuestion = async (req, res, next) => {
  try {
    const { id } = req.params; // product_id hoặc slug
    const { question_text, parent_question_id } = req.body;

    if (!question_text || !question_text.trim()) {
      return res.status(400).json({ message: "question_text is required" });
    }

    // 1. Tìm Product
    const whereKey = /^\d+$/.test(String(id))
      ? { product_id: id }
      : { slug: id };
      
    const product = await Product.findOne({
      where: whereKey,
      attributes: ["product_id", "product_name"],
    });

    if (!product) return res.status(404).json({ message: "Product not found" });

    // 2. Logic Parent Question (nếu là reply)
    let parent = null;
    if (parent_question_id) {
      parent = await Question.findByPk(parent_question_id, {
        attributes: ["question_id", "product_id", "parent_question_id"],
      });
      
      if (!parent) {
        return res.status(404).json({ message: "Parent question not found" });
      }
      // Chỉ cho phép 1 cấp follow-up
      if (parent.parent_question_id) {
        return res.status(400).json({ message: "Only one follow-up level is allowed" });
      }
      // Cùng sản phẩm
      if (parent.product_id !== product.product_id) {
        return res.status(400).json({ message: "Parent question does not belong to this product" });
      }
      // Parent phải đã được trả lời
      const answered = await Answer.findOne({
        where: { question_id: parent.question_id },
      });
      if (!answered) {
        return res.status(400).json({ message: "Parent must be answered before follow-up" });
      }
    }

    // 3. Tạo Question
    // SỬA: Dùng đúng req.user.user_id như code cũ yêu cầu (đã qua middleware auth)
    const q = await Question.create({
      product_id: product.product_id,
      user_id: req.user.user_id, 
      question_text: question_text.trim(),
      is_answered: false,
      parent_question_id: parent_question_id || null,
    });

    // 4. Lấy data trả về (kèm User info)
    const withUser = await Question.findByPk(q.question_id, {
      attributes: [
        "question_id",
        "question_text",
        "is_answered",
        "created_at",
        "parent_question_id",
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "username", "full_name"],
        },
      ],
    });

    // 5. GỬI THÔNG BÁO CHO ADMIN/STAFF
    // Logic: Tìm tất cả Admin/Staff và bắn thông báo cho từng người
    try {
        const notifTitle = parent_question_id ? "Phản hồi mới 💬" : "Câu hỏi mới ❓";
        const notifMessage = parent_question_id 
          ? `Khách hàng phản hồi câu trả lời tại sản phẩm: ${product.product_name}`
          : `Có câu hỏi mới về sản phẩm: ${product.product_name}`;

        // Tìm list users có role admin hoặc staff
        const staffUsers = await User.findAll({
            attributes: ['user_id'],
            include: [{
                model: Role,
                as: 'Roles',
                where: { role_name: ['admin', 'staff'] },
                required: true
            }]
        });

        if (staffUsers.length > 0) {
            const notiPromises = staffUsers.map(staff => {
                return notificationService.createNotification({
                    userId: staff.user_id, // Gửi đích danh ID để socket hoạt động chuẩn
                    title: notifTitle,
                    message: notifMessage,
                    type: "new_question",
                    relatedType: "product",
                    relatedId: product.product_id
                });
            });

            await Promise.all(notiPromises);
        }
    } catch (notifError) {
        console.error(">>> [DEBUG] Lỗi gửi thông báo:", notifError);
    }

    return res.status(201).json({ question: withUser });

  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
       return res.status(409).json({ message: "This question already has a follow-up" });
    }
    next(err);
  }
};

// === DANH SÁCH Q&A TOÀN HỆ THỐNG (dùng cho HomePage) ===
exports.getGlobalQuestions = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "3", 10)));
    const offset =
      req.query.offset != null
        ? Math.max(0, parseInt(req.query.offset || "0", 10))
        : (page - 1) * limit;

    const where = { parent_question_id: null };

    const { count, rows } = await Question.findAndCountAll({
      where,
      attributes: [
        "question_id",
        "product_id",
        "question_text",
        "is_answered",
        "created_at",
        "parent_question_id",
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "username", "full_name"],
        },
        {
          model: Product,
          as: "product",
          attributes: ["product_id", "product_name", "slug"],
          required: false,
        },
        {
          model: Answer,
          as: "answers",
          attributes: ["answer_id", "answer_text", "created_at"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_id", "username", "full_name"],
            },
          ],
        },
      ],
      order: [
        ["created_at", "DESC"],
        [{ model: Answer, as: "answers" }, "created_at", "ASC"],
      ],
      limit,
      offset,
      distinct: true,
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json({
      questions: rows,
      total: count,
      page,
      limit,
      offset,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    });
  } catch (err) {
    next(err);
  }
};

// === TẠO CÂU HỎI CHUNG (KHÔNG GẮN PRODUCT) ===
exports.createGlobalQuestion = async (req, res, next) => {
  try {
    const { question_text } = req.body;
    if (!question_text || !question_text.trim()) {
      return res.status(400).json({ message: "question_text is required" });
    }

    const q = await Question.create({
      product_id: null,
      user_id: req.user.user_id,
      question_text: question_text.trim(),
      is_answered: false,
      parent_question_id: null,
    });

    const withUser = await Question.findByPk(q.question_id, {
      attributes: [
        "question_id",
        "product_id",
        "question_text",
        "is_answered",
        "created_at",
        "parent_question_id",
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "username", "full_name"],
        },
      ],
    });

    return res.status(201).json({ question: withUser });
  } catch (err) {
    next(err);
  }
};

// === TRẢ LỜI CÂU HỎI (SỬA: dùng req.user.user_id) ===
exports.createAnswer = async (req, res, next) => {
  try {
    const { question_id } = req.params;
    const { answer_text } = req.body;

    if (!answer_text || !answer_text.trim()) {
      return res.status(400).json({ message: "answer_text is required" });
    }

    // role check
    const roles = (req.user.Roles || []).map((r) => r.role_name);
    const isStaff = roles.includes("admin") || roles.includes("staff");
    if (!isStaff) {
      return res.status(403).json({ message: "Only staff can answer" });
    }

    const q = await Question.findByPk(question_id);
    if (!q) return res.status(404).json({ message: "Question not found" });

    const existed = await Answer.findOne({
      where: { question_id: q.question_id },
    });
    if (existed) {
      return res
        .status(409)
        .json({ message: "This question already has an answer" });
    }

    const a = await Answer.create({
      question_id: q.question_id,
      user_id: req.user.user_id,
      answer_text: answer_text.trim(),
    });

    if (!q.is_answered) await q.update({ is_answered: true });

    const withUser = await Answer.findByPk(a.answer_id, {
      attributes: ["answer_id", "answer_text", "created_at"],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "username", "full_name"],
        },
      ],
    });

    const question = await Question.findByPk(req.params.question_id);
  
    if (question.user_id) { // Chỉ gửi nếu người hỏi là thành viên
      notificationService.createNotification({
        userId: question.user_id,
        title: "Phản hồi mới",
        message: "Admin đã trả lời câu hỏi của bạn.",
        type: "new_answer",
        relatedType: "product",
        relatedId: question.product_id
      });
   }

    return res.status(201).json({ answer: withUser });
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res
        .status(409)
        .json({ message: "This question already has an answer" });
    }
    next(err);
  }
};

// exports.createAnswer = async (req, res, next) => {
//   console.log(">>> [DEBUG] Bắt đầu createAnswer"); // Log 1
//   try {
//     const { question_id } = req.params;
//     const { answer_text } = req.body;

//     if (!answer_text || !answer_text.trim()) {
//       return res.status(400).json({ message: "answer_text is required" });
//     }

//     // role check
//     const roles = (req.user.Roles || []).map((r) => r.role_name);
//     const isStaff = roles.includes("admin") || roles.includes("staff");
//     if (!isStaff) {
//       return res.status(403).json({ message: "Only staff can answer" });
//     }

//     const q = await Question.findByPk(question_id);
//     if (!q) return res.status(404).json({ message: "Question not found" });

//     // Tạo câu trả lời
//     const a = await Answer.create({
//       question_id: q.question_id,
//       user_id: req.user.user_id,
//       answer_text: answer_text.trim(),
//     });
//     console.log(">>> [DEBUG] Đã tạo Answer thành công, ID:", a.answer_id); // Log 2

//     // Cập nhật trạng thái câu hỏi
//     if (!q.is_answered) {
//       await q.update({ is_answered: true });
//     }

//     // --- LOGIC GỬI THÔNG BÁO ---
//     console.log(">>> [DEBUG] Bắt đầu gửi thông báo..."); // Log 3
//     try {
//         // Lấy lại thông tin câu hỏi để chắc chắn có user_id
//         const question = await Question.findByPk(question_id);
        
//         console.log(">>> [DEBUG] Question User ID:", question?.user_id); // Log 4

//         if (question && question.user_id) {
//              console.log(">>> [DEBUG] Gọi notificationService..."); // Log 5
             
//              await notificationService.createNotification({
//                 userId: question.user_id,
//                 title: "Phản hồi mới 💬",
//                 message: "Admin đã trả lời câu hỏi của bạn.",
//                 type: "new_answer",
//                 relatedType: "product",
//                 relatedId: question.product_id
//             });
//             console.log(">>> [DEBUG] Đã gọi service thành công!"); // Log 6
//         } else {
//             console.log(">>> [DEBUG] Không gửi thông báo: Question không có user_id (Khách vãng lai?)");
//         }
//     } catch (notifError) {
//         console.error(">>> [DEBUG] LỖI GỬI THÔNG BÁO:", notifError);
//     }
//     // ---------------------------

//     return res.status(201).json({ answer: a }); 

//   } catch (err) {
//     console.error(">>> [DEBUG] Lỗi createAnswer:", err);
//     next(err);
//   }
// };

// === DANH SÁCH CÂU HỎI CỦA 1 PRODUCT (tuỳ bạn dùng hay không; FE bạn đang lấy qua getProductDetail rồi) ===
exports.getProductQuestions = async (req, res, next) => {
  try {
    const { id } = req.params; // product_id hoặc slug
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit || "10", 10))
    );
    const offset = (page - 1) * limit;

    const whereKey = /^\d+$/.test(String(id))
      ? { product_id: id }
      : { slug: id };
    const product = await Product.findOne({
      where: whereKey,
      attributes: ["product_id"],
    });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const { count, rows } = await Question.findAndCountAll({
      where: { product_id: product.product_id },
      attributes: ["question_id", "question_text", "is_answered", "created_at"],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "username", "full_name"],
        },
        {
          model: Answer,
          as: "answers",
          attributes: ["answer_id", "answer_text", "created_at"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_id", "username", "full_name"],
            },
          ],
        },
      ],
      order: [
        ["created_at", "DESC"],
        [{ model: Answer, as: "answers" }, "created_at", "ASC"],
      ],
      limit,
      offset,
    });

    res.json({
      questions: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (e) {
    next(e);
  }
};

// === SỬA CÂU HỎI (chỉ chủ sở hữu hoặc admin/staff) ===
exports.updateQuestion = async (req, res, next) => {
  try {
    const { question_id } = req.params;
    const { question_text } = req.body;
    if (!question_text || !question_text.trim()) {
      return res.status(400).json({ message: "question_text is required" });
    }

    const q = await Question.findByPk(question_id);
    if (!q) return res.status(404).json({ message: "Question not found" });

    const isOwner = q.user_id === req.user.user_id;
    const userRoles = (req.user.Roles || []).map((r) => r.role_name);
    const isStaff = userRoles.includes("admin") || userRoles.includes("staff");
    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    await q.update({ question_text: question_text.trim() });
    res.json({ question: q });
  } catch (e) {
    next(e);
  }
};

// === XOÁ CÂU HỎI (chỉ chủ sở hữu hoặc admin/staff); xoá kèm answer ===
exports.deleteQuestion = async (req, res, next) => {
  try {
    const { question_id } = req.params;
    const q = await Question.findByPk(question_id);
    if (!q) return res.status(404).json({ message: "Question not found" });

    const isOwner = q.user_id === req.user.user_id;
    const userRoles = (req.user.Roles || []).map((r) => r.role_name);
    const isStaff = userRoles.includes("admin") || userRoles.includes("staff");
    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    await Answer.destroy({ where: { question_id: q.question_id } });
    await q.destroy();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

exports.compareProducts = async (req, res, next) => {
  try {
    // nhận ids: [1,2,3] hoặc query '1,2,3'
    const ids = Array.isArray(req.body.ids)
      ? req.body.ids
      : String(req.query.ids || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

    if (!ids.length) {
      return res
        .status(400)
        .json({ message: "ids is required (array or comma-separated)" });
    }

    const products = await Product.findAll({
      where: { product_id: { [Op.in]: ids } },
      attributes: [
        "product_id",
        "product_name",
        "thumbnail_url",
        "base_price",
        "discount_percentage",
        "specs",
      ],
      include: [
        // tuỳ: brand/category nếu muốn show kèm
      ],
    });

    // Chuẩn hoá: hợp nhất danh sách group và label → tạo khung ma trận
    const allGroups = new Set();
    const labelsByGroup = {}; // { group: Set<label> }

    for (const p of products) {
      const specs = p.specs || {};
      Object.keys(specs).forEach((group) => {
        allGroups.add(group);
        if (!labelsByGroup[group]) labelsByGroup[group] = new Set();
        specs[group].forEach((row) => labelsByGroup[group].add(row.label));
      });
    }

    // Biến Set -> Array & sắp xếp nhẹ cho ổn định
    const groups = [...allGroups];
    const normalized = groups.map((group) => {
      const labels = [...(labelsByGroup[group] || [])];
      return {
        group,
        rows: labels.map((label) => ({
          label,
          values: products.map((p) => {
            const list = p.specs?.[group] || [];
            const found = list.find((r) => r.label === label);
            return found?.value || "—";
          }),
        })),
      };
    });

    res.json({
      products: products.map((p) => ({
        id: p.product_id,
        name: p.product_name,
        thumbnail_url: p.thumbnail_url,
        base_price: p.base_price,
        discount_percentage: p.discount_percentage,
      })),
      compare: normalized,
    });
  } catch (err) {
    next(err);
  }
};
