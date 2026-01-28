import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ResourceLoaderFactory,
  createResourceLoader,
  Environment,
  ResourceLoaderFactoryOptions,
} from "../core/resource-loader-factory";
import { NodeResourceLoader } from "../platforms/node/node-resource-loader";

// Mock NodeResourceLoader
vi.mock("../platforms/node/node-resource-loader", () => {
  const MockConstructor = vi.fn();
  MockConstructor.prototype.load = vi.fn();
  MockConstructor.prototype.loadMultiple = vi.fn();
  MockConstructor.prototype.canLoad = vi.fn();
  MockConstructor.prototype.exists = vi.fn();
  MockConstructor.prototype.getStats = vi.fn();
  MockConstructor.prototype.setBaseDir = vi.fn();
  MockConstructor.prototype.getBaseDir = vi.fn();
  MockConstructor.prototype.listDirectory = vi.fn();

  return {
    NodeResourceLoader: MockConstructor,
  };
});

describe("ResourceLoaderFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Environment Detection", () => {
    it("should detect Node environment", () => {
      const env = ResourceLoaderFactory.detectEnvironment();

      expect(env).toBe(Environment.NODE);
    });

    it("should return false for isBrowser", () => {
      const isBrowser = ResourceLoaderFactory.isBrowser();

      expect(isBrowser).toBe(false);
    });

    it("should return true for isNode", () => {
      const isNode = ResourceLoaderFactory.isNode();

      expect(isNode).toBe(true);
    });

    it("should have NODE enum value", () => {
      expect(Environment.NODE).toBe("node");
    });
  });

  describe("Factory Methods", () => {
    it("should create NodeResourceLoader via create method", async () => {
      const loader = await ResourceLoaderFactory.create();

      expect(loader).toBeDefined();
      expect(NodeResourceLoader).toHaveBeenCalledTimes(1);
      expect(NodeResourceLoader).toHaveBeenCalledWith(undefined);
    });

    it("should create NodeResourceLoader with baseDir", async () => {
      const baseDir = "/test/path";

      const loader = await ResourceLoaderFactory.create({ baseDir });

      expect(loader).toBeDefined();
      expect(NodeResourceLoader).toHaveBeenCalledWith(baseDir);
    });

    it("should create NodeResourceLoader via createNodeLoader method", async () => {
      const loader = await ResourceLoaderFactory.createNodeLoader();

      expect(loader).toBeDefined();
      expect(NodeResourceLoader).toHaveBeenCalledTimes(1);
      expect(NodeResourceLoader).toHaveBeenCalledWith(undefined);
    });

    it("should create NodeResourceLoader with baseDir via createNodeLoader", async () => {
      const baseDir = "/another/path";

      const loader = await ResourceLoaderFactory.createNodeLoader({ baseDir });

      expect(loader).toBeDefined();
      expect(NodeResourceLoader).toHaveBeenCalledWith(baseDir);
    });
  });

  describe("Convenience Function", () => {
    it("should create loader via createResourceLoader helper", async () => {
      const loader = await createResourceLoader();

      expect(loader).toBeDefined();
      expect(NodeResourceLoader).toHaveBeenCalledTimes(1);
      expect(NodeResourceLoader).toHaveBeenCalledWith(undefined);
    });

    it("should create loader with options via createResourceLoader helper", async () => {
      const options: ResourceLoaderFactoryOptions = { baseDir: "/helper/path" };

      const loader = await createResourceLoader(options);

      expect(loader).toBeDefined();
      expect(NodeResourceLoader).toHaveBeenCalledWith(options.baseDir);
    });
  });

  describe("Multiple Calls", () => {
    it("should create separate loader instances", async () => {
      const loader1 = await ResourceLoaderFactory.create();
      const loader2 = await ResourceLoaderFactory.create();

      expect(loader1).toBeDefined();
      expect(loader2).toBeDefined();
      expect(NodeResourceLoader).toHaveBeenCalledTimes(2);
    });

    it("should handle multiple calls with different options", async () => {
      await ResourceLoaderFactory.create({ baseDir: "/path1" });
      await ResourceLoaderFactory.create({ baseDir: "/path2" });

      expect(NodeResourceLoader).toHaveBeenCalledTimes(2);
      expect(NodeResourceLoader).toHaveBeenNthCalledWith(1, "/path1");
      expect(NodeResourceLoader).toHaveBeenNthCalledWith(2, "/path2");
    });
  });

  describe("Empty Options", () => {
    it("should handle empty options object", async () => {
      const loader = await ResourceLoaderFactory.create({});

      expect(loader).toBeDefined();
      expect(NodeResourceLoader).toHaveBeenCalledWith(undefined);
    });
  });
});
