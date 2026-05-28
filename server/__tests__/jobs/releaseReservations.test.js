const mockTransaction = {
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
  LOCK: { UPDATE: "UPDATE" },
}

let scheduledJob
let registeredCronExpression

jest.mock("node-cron", () => ({
  schedule: jest.fn((expr, fn) => {
    registeredCronExpression = expr
    scheduledJob = fn
    return { stop: jest.fn() }
  }),
}))

jest.mock("../../config/database", () => ({
  transaction: jest.fn(() => Promise.resolve(mockTransaction)),
}))

jest.mock("sequelize", () => ({
  Op: { lt: Symbol.for("lt") },
}))

jest.mock("../../models", () => ({
  sequelize: {
    query: jest.fn(),
    transaction: jest.fn(() => Promise.resolve(mockTransaction)),
  },
  Order: { findAll: jest.fn() },
  OrderItem: { findAll: jest.fn() },
  ProductVariation: { findOne: jest.fn() },
  Payment: { update: jest.fn().mockResolvedValue([1]) },
  Sequelize: {},
}))

const cron = require("node-cron")
const { Op } = require("sequelize")
const { sequelize, Order, OrderItem, ProductVariation, Payment } = require("../../models")

require("../../jobs/releaseReservations")

const buildExpiredOrder = (overrides = {}) => ({
  order_id: 900,
  status: "AWAITING_PAYMENT",
  reserve_expires_at: new Date(Date.now() - 60_000),
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
})

const setupAdvisoryLockAcquired = () => {
  sequelize.query.mockImplementation((sql) => {
    if (String(sql).includes("pg_try_advisory_lock")) {
      return Promise.resolve([[{ locked: true }]])
    }
    if (String(sql).includes("pg_advisory_unlock")) {
      return Promise.resolve([[]])
    }
    return Promise.resolve([[]])
  })
}

describe("FR_ReleaseExpiredReservationsJob — releaseReservations cron", () => {
  beforeEach(() => {
    Order.findAll.mockReset()
    OrderItem.findAll.mockReset()
    ProductVariation.findOne.mockReset()
    Payment.update.mockReset()
    Payment.update.mockResolvedValue([1])
    sequelize.transaction.mockImplementation(() => Promise.resolve(mockTransaction))
    setupAdvisoryLockAcquired()
    mockTransaction.commit.mockClear()
    mockTransaction.rollback.mockClear()
  })

  it("registers cron schedule every 2 minutes (BR-03)", () => {
    expect(registeredCronExpression).toBe("*/2 * * * *")
    expect(scheduledJob).toEqual(expect.any(Function))
  })

  it("restores stock, fails payment and cancels expired AWAITING_PAYMENT orders (§6.2)", async () => {
    const increment = jest.fn().mockResolvedValue(undefined)
    const order = buildExpiredOrder()

    Order.findAll.mockResolvedValue([order])
    OrderItem.findAll.mockResolvedValue([{ variation_id: 10, quantity: 3 }])
    ProductVariation.findOne.mockResolvedValue({ increment })

    await scheduledJob()

    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining("pg_try_advisory_lock(987654321)")
    )
    expect(Order.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "AWAITING_PAYMENT" }),
        lock: mockTransaction.LOCK.UPDATE,
        skipLocked: true,
      })
    )
    expect(increment).toHaveBeenCalledWith("stock_quantity", {
      by: 3,
      transaction: mockTransaction,
    })
    expect(Payment.update).toHaveBeenCalledWith(
      { payment_status: "failed" },
      expect.objectContaining({
        where: {
          order_id: 900,
          provider: "VNPAY",
          payment_status: "pending",
        },
        transaction: mockTransaction,
      })
    )
    expect(order.status).toBe("cancelled")
    expect(order.reserve_expires_at).toBeNull()
    expect(order.save).toHaveBeenCalledWith(
      expect.objectContaining({ transaction: mockTransaction })
    )
    expect(mockTransaction.commit).toHaveBeenCalled()
  })

  it("calls pg_advisory_unlock(987654321) after successful tick (BR-05)", async () => {
    Order.findAll.mockResolvedValue([])

    await scheduledJob()

    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_unlock(987654321)")
    )
  })

  it("queries expired orders with AWAITING_PAYMENT and reserve_expires_at Op.lt now (BR-08)", async () => {
    Order.findAll.mockResolvedValue([])

    await scheduledJob()

    const findCall = Order.findAll.mock.calls[0][0]
    expect(findCall.where.status).toBe("AWAITING_PAYMENT")
    expect(findCall.where.reserve_expires_at).toEqual({
      [Op.lt]: expect.any(Date),
    })
  })

  it("commits without Payment.update when no expired orders", async () => {
    Order.findAll.mockResolvedValue([])

    await scheduledJob()

    expect(Payment.update).not.toHaveBeenCalled()
    expect(OrderItem.findAll).not.toHaveBeenCalled()
    expect(mockTransaction.commit).toHaveBeenCalled()
    expect(mockTransaction.rollback).not.toHaveBeenCalled()
  })

  it("increments stock per OrderItem line quantity (BR-09)", async () => {
    const increment10 = jest.fn().mockResolvedValue(undefined)
    const increment20 = jest.fn().mockResolvedValue(undefined)
    const order = buildExpiredOrder({ order_id: 901 })

    Order.findAll.mockResolvedValue([order])
    OrderItem.findAll.mockResolvedValue([
      { variation_id: 10, quantity: 2 },
      { variation_id: 20, quantity: 5 },
    ])
    ProductVariation.findOne.mockImplementation(({ where }) => {
      if (where.variation_id === 10) return Promise.resolve({ increment: increment10 })
      if (where.variation_id === 20) return Promise.resolve({ increment: increment20 })
      return Promise.resolve(null)
    })

    await scheduledJob()

    expect(increment10).toHaveBeenCalledWith("stock_quantity", {
      by: 2,
      transaction: mockTransaction,
    })
    expect(increment20).toHaveBeenCalledWith("stock_quantity", {
      by: 5,
      transaction: mockTransaction,
    })
  })

  it("skips processing when advisory lock is not acquired (BR-06)", async () => {
    sequelize.query.mockImplementation((sql) => {
      if (String(sql).includes("pg_try_advisory_lock")) {
        return Promise.resolve([[{ locked: false }]])
      }
      return Promise.resolve([[]])
    })

    await scheduledJob()

    expect(Order.findAll).not.toHaveBeenCalled()
    expect(mockTransaction.commit).not.toHaveBeenCalled()
    expect(sequelize.query).not.toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_unlock")
    )
  })

  it("rolls back and logs when Order.findAll throws (BR-14)", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    Order.findAll.mockRejectedValue(new Error("DB find failed"))

    await scheduledJob()

    expect(mockTransaction.rollback).toHaveBeenCalled()
    expect(mockTransaction.commit).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      "[releaseReservations] error:",
      "DB find failed"
    )
    consoleSpy.mockRestore()
  })

  it("still cancels order when ProductVariation.findOne returns null (GAP-02)", async () => {
    const order = buildExpiredOrder({ order_id: 902 })

    Order.findAll.mockResolvedValue([order])
    OrderItem.findAll.mockResolvedValue([{ variation_id: 99, quantity: 1 }])
    ProductVariation.findOne.mockResolvedValue(null)

    await scheduledJob()

    expect(order.status).toBe("cancelled")
    expect(order.reserve_expires_at).toBeNull()
    expect(order.save).toHaveBeenCalled()
    expect(Payment.update).toHaveBeenCalled()
    expect(mockTransaction.commit).toHaveBeenCalled()
  })
})
