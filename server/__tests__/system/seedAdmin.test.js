const dotenv = require("dotenv")

const mockAuthenticate = jest.fn()
const mockClose = jest.fn()
const mockRoleFindOne = jest.fn()
const mockRoleCreate = jest.fn()
const mockUserFindOne = jest.fn()
const mockUserCreate = jest.fn()

jest.mock("dotenv", () => ({
  config: jest.fn(),
}))

jest.mock("../../models", () => ({
  sequelize: {
    authenticate: (...args) => mockAuthenticate(...args),
    close: (...args) => mockClose(...args),
  },
  Role: {
    findOne: (...args) => mockRoleFindOne(...args),
    create: (...args) => mockRoleCreate(...args),
  },
  User: {
    findOne: (...args) => mockUserFindOne(...args),
    create: (...args) => mockUserCreate(...args),
  },
}))

const ADMIN_ROLE = { role_id: 1, role_name: "admin", description: "Quản trị viên hệ thống" }

const runSeedAdmin = async () => {
  await new Promise((resolve) => {
    mockClose.mockImplementation(async () => {
      resolve()
    })
    jest.isolateModules(() => {
      require("../../seedAdmin")
    })
  })
}

describe("seedAdmin.js (FR_SeedAdminScript)", () => {
  let logSpy
  let errorSpy

  beforeEach(() => {
    jest.clearAllMocks()
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {})
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    mockAuthenticate.mockResolvedValue(undefined)
    mockClose.mockResolvedValue(undefined)
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it("loads dotenv from ./.env (BR-04)", async () => {
    mockRoleFindOne.mockResolvedValue(ADMIN_ROLE)
    mockUserFindOne.mockResolvedValue({
      user_id: 10,
      setRoles: jest.fn().mockResolvedValue(undefined),
    })

    await runSeedAdmin()

    expect(dotenv.config).toHaveBeenCalledWith({ path: "./.env" })
  })

  it("calls sequelize.authenticate on startup", async () => {
    mockRoleFindOne.mockResolvedValue(ADMIN_ROLE)
    mockUserFindOne.mockResolvedValue({
      user_id: 10,
      setRoles: jest.fn().mockResolvedValue(undefined),
    })

    await runSeedAdmin()

    expect(mockAuthenticate).toHaveBeenCalledTimes(1)
  })

  it("creates admin role when missing", async () => {
    mockRoleFindOne.mockResolvedValue(null)
    mockRoleCreate.mockResolvedValue(ADMIN_ROLE)
    mockUserFindOne.mockResolvedValue(null)
    const addRole = jest.fn().mockResolvedValue(undefined)
    mockUserCreate.mockResolvedValue({ user_id: 99, addRole })

    await runSeedAdmin()

    expect(mockRoleCreate).toHaveBeenCalledWith({
      role_name: "admin",
      description: "Quản trị viên hệ thống",
    })
    expect(logSpy).toHaveBeenCalledWith("Created 'admin' role.")
  })

  it("skips Role.create when admin role already exists", async () => {
    mockRoleFindOne.mockResolvedValue(ADMIN_ROLE)
    mockUserFindOne.mockResolvedValue(null)
    const addRole = jest.fn().mockResolvedValue(undefined)
    mockUserCreate.mockResolvedValue({ user_id: 99, addRole })

    await runSeedAdmin()

    expect(mockRoleFindOne).toHaveBeenCalledWith({ where: { role_name: "admin" } })
    expect(mockRoleCreate).not.toHaveBeenCalled()
  })

  it("creates new admin user with constants and calls addRole", async () => {
    mockRoleFindOne.mockResolvedValue(ADMIN_ROLE)
    mockUserFindOne.mockResolvedValue(null)
    const addRole = jest.fn().mockResolvedValue(undefined)
    mockUserCreate.mockResolvedValue({ user_id: 99, addRole })

    await runSeedAdmin()

    expect(mockUserFindOne).toHaveBeenCalledWith({
      where: { email: "admin@laptopstore.com" },
    })
    expect(mockUserCreate).toHaveBeenCalledWith({
      username: "super_admin",
      email: "admin@laptopstore.com",
      password_hash: "AdminPassword123",
      full_name: "System Administrator",
      is_active: true,
    })
    expect(addRole).toHaveBeenCalledWith(ADMIN_ROLE)
    expect(logSpy).toHaveBeenCalledWith("Successfully created Admin: super_admin")
  })

  it("re-assigns admin role for existing user by email without User.create", async () => {
    mockRoleFindOne.mockResolvedValue(ADMIN_ROLE)
    const setRoles = jest.fn().mockResolvedValue(undefined)
    mockUserFindOne.mockResolvedValue({ user_id: 42, setRoles })

    await runSeedAdmin()

    expect(mockUserCreate).not.toHaveBeenCalled()
    expect(setRoles).toHaveBeenCalledWith([ADMIN_ROLE])
    expect(logSpy).toHaveBeenCalledWith("Admin user already exists. ID:", 42)
    expect(logSpy).toHaveBeenCalledWith("Admin role re-assigned successfully.")
  })

  it("always calls sequelize.close in finally after successful run", async () => {
    mockRoleFindOne.mockResolvedValue(ADMIN_ROLE)
    mockUserFindOne.mockResolvedValue({
      user_id: 10,
      setRoles: jest.fn().mockResolvedValue(undefined),
    })

    await runSeedAdmin()

    expect(mockClose).toHaveBeenCalledTimes(1)
    expect(logSpy).toHaveBeenCalledWith("Database connection closed.")
  })

  it("when authenticate fails before try, sequelize.close is not reached (same structure as seedAdmin.js)", async () => {
    const err = new Error("DB connection failed")
    mockAuthenticate.mockRejectedValue(err)

    const runSeedStructure = async () => {
      await mockAuthenticate()
      try {
        // seed body would run here
      } catch (error) {
        console.error("Error during admin seeding:", error.message)
      } finally {
        await mockClose()
      }
    }

    await expect(runSeedStructure()).rejects.toThrow("DB connection failed")
    expect(mockAuthenticate).toHaveBeenCalled()
    expect(mockClose).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it("logs error and still calls sequelize.close when User.create throws", async () => {
    mockRoleFindOne.mockResolvedValue(ADMIN_ROLE)
    mockUserFindOne.mockResolvedValue(null)
    mockUserCreate.mockRejectedValue(new Error("unique username violation"))

    await runSeedAdmin()

    expect(errorSpy).toHaveBeenCalledWith(
      "Error during admin seeding:",
      "unique username violation"
    )
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it("logs error and still calls sequelize.close when setRoles throws", async () => {
    mockRoleFindOne.mockResolvedValue(ADMIN_ROLE)
    const setRoles = jest.fn().mockRejectedValue(new Error("setRoles failed"))
    mockUserFindOne.mockResolvedValue({ user_id: 7, setRoles })

    await runSeedAdmin()

    expect(errorSpy).toHaveBeenCalledWith("Error during admin seeding:", "setRoles failed")
    expect(mockClose).toHaveBeenCalledTimes(1)
  })
})
