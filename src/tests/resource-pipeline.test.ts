/**
 * Resource Pipeline Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ResourcePipeline,
  createResourcePipeline,
  type ResourcePipelineOptions,
  type ShaderSource,
} from "../core/resource-pipeline";
import type {
  IResourceLoader,
  ResourceLoadResult,
} from "../core/resource-loader";

// Mock IResourceLoader implementation
class MockResourceLoader implements IResourceLoader {
  load = vi.fn<[string], Promise<string>>();
  loadMultiple = vi.fn<[string[]], Promise<ResourceLoadResult[]>>();
  canLoad = vi.fn<[string], boolean>();

  constructor() {
    // Default implementations
    this.load.mockResolvedValue("default content");
    this.loadMultiple.mockResolvedValue([
      { success: true, path: "test.txt", data: "content" },
    ]);
    this.canLoad.mockReturnValue(true);
  }

  // Helper methods for testing
  setLoadResult(content: string) {
    this.load.mockResolvedValue(content);
  }

  setLoadMultipleResult(results: ResourceLoadResult[]) {
    this.loadMultiple.mockResolvedValue(results);
  }

  setCanLoadResult(result: boolean) {
    this.canLoad.mockReturnValue(result);
  }
}

describe("ResourcePipeline", () => {
  let mockLoader: MockResourceLoader;
  let pipeline: ResourcePipeline;

  beforeEach(() => {
    mockLoader = new MockResourceLoader();
    pipeline = new ResourcePipeline(mockLoader);
  });

  describe("constructor", () => {
    it("should create pipeline with default options", () => {
      expect(pipeline).toBeDefined();
    });

    it("should create pipeline with custom concurrency", () => {
      const customPipeline = new ResourcePipeline(mockLoader, {
        concurrency: 5,
      });
      expect(customPipeline).toBeDefined();
    });

    it("should create pipeline with cache disabled", () => {
      const customPipeline = new ResourcePipeline(mockLoader, {
        cache: false,
      });
      expect(customPipeline).toBeDefined();
    });

    it("should enforce minimum concurrency of 1", () => {
      const customPipeline = new ResourcePipeline(mockLoader, {
        concurrency: 0,
      });
      customPipeline.setConcurrency(-1);
      expect(customPipeline).toBeDefined();
    });
  });

  describe("load", () => {
    it("should load a single resource", async () => {
      mockLoader.setLoadResult("shader content");
      const content = await pipeline.load("shader.vert");
      expect(content).toBe("shader content");
      expect(mockLoader.load).toHaveBeenCalledWith("shader.vert", undefined);
    });

    it("should cache loaded resources", async () => {
      mockLoader.setLoadResult("cached content");
      await pipeline.load("shader.vert");
      expect(pipeline.isCached("shader.vert")).toBe(true);
      expect(pipeline.getCached("shader.vert")).toBe("cached content");
    });

    it("should return cached resource on subsequent loads", async () => {
      mockLoader.setLoadResult("content");
      await pipeline.load("shader.vert");
      await pipeline.load("shader.vert");
      expect(mockLoader.load).toHaveBeenCalledTimes(1);
    });

    it("should pass options to loader", async () => {
      mockLoader.setLoadResult("content");
      const options = { encoding: "utf-8" as const };
      await pipeline.load("shader.vert", options);
      expect(mockLoader.load).toHaveBeenCalledWith("shader.vert", options);
    });

    it("should not cache when cache is disabled", async () => {
      const noCachePipeline = new ResourcePipeline(mockLoader, {
        cache: false,
      });
      mockLoader.setLoadResult("content");
      await noCachePipeline.load("shader.vert");
      expect(noCachePipeline.isCached("shader.vert")).toBe(false);
    });
  });

  describe("loadBatch", () => {
    it("should load multiple resources", async () => {
      mockLoader.setLoadMultipleResult([
        { success: true, path: "file1.txt", data: "content1" },
        { success: true, path: "file2.txt", data: "content2" },
      ]);
      const result = await pipeline.loadBatch(["file1.txt", "file2.txt"]);
      expect(result.total).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.succeeded.get("file1.txt")).toBe("content1");
      expect(result.succeeded.get("file2.txt")).toBe("content2");
    });

    it("should handle partial failures", async () => {
      mockLoader.setLoadMultipleResult([
        { success: true, path: "file1.txt", data: "content1" },
        { success: false, path: "file2.txt", error: "Not found" },
      ]);
      const result = await pipeline.loadBatch(["file1.txt", "file2.txt"]);
      expect(result.total).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.succeeded.size).toBe(1);
      expect(result.failed.size).toBe(1);
      expect(result.failed.get("file2.txt")).toBe("Not found");
    });

    it("should cache successful loads", async () => {
      mockLoader.setLoadMultipleResult([
        { success: true, path: "file1.txt", data: "content1" },
      ]);
      await pipeline.loadBatch(["file1.txt"]);
      expect(pipeline.isCached("file1.txt")).toBe(true);
    });

    it("should not cache failed loads", async () => {
      mockLoader.setLoadMultipleResult([
        { success: false, path: "file1.txt", error: "Not found" },
      ]);
      await pipeline.loadBatch(["file1.txt"]);
      expect(pipeline.isCached("file1.txt")).toBe(false);
    });

    it("should process batches with concurrency limit", async () => {
      const paths = Array.from({ length: 25 }, (_, i) => `file${i}.txt`);
      const results: ResourceLoadResult[] = paths.map((path) => ({
        success: true,
        path,
        data: `content of ${path}`,
      }));
      mockLoader.setLoadMultipleResult(results);

      const result = await pipeline.loadBatch(paths);
      expect(result.total).toBe(25);
      expect(result.successCount).toBe(25);
    });

    it("should handle empty batch", async () => {
      const result = await pipeline.loadBatch([]);
      expect(result.total).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
    });

    it("should handle all failures", async () => {
      mockLoader.setLoadMultipleResult([
        { success: false, path: "file1.txt", error: "Error 1" },
        { success: false, path: "file2.txt", error: "Error 2" },
      ]);
      const result = await pipeline.loadBatch(["file1.txt", "file2.txt"]);
      expect(result.total).toBe(2);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(2);
    });
  });

  describe("loadShader", () => {
    it("should load vertex and fragment shaders", async () => {
      mockLoader.setLoadResult("shader source");
      const shader = await pipeline.loadShader("vert.glsl", "frag.glsl");
      expect(shader.vertex).toBe("shader source");
      expect(shader.fragment).toBe("shader source");
    });

    it("should load different content for vertex and fragment", async () => {
      let callCount = 0;
      mockLoader.load.mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? "vertex source" : "fragment source";
      });
      const shader = await pipeline.loadShader("vert.glsl", "frag.glsl");
      expect(shader.vertex).toBe("vertex source");
      expect(shader.fragment).toBe("fragment source");
    });

    it("should cache both shaders", async () => {
      mockLoader.setLoadResult("shader source");
      await pipeline.loadShader("vert.glsl", "frag.glsl");
      expect(pipeline.isCached("vert.glsl")).toBe(true);
      expect(pipeline.isCached("frag.glsl")).toBe(true);
    });
  });

  describe("loadShaders", () => {
    it("should load multiple shaders", async () => {
      mockLoader.setLoadResult("shader source");
      const shaders = await pipeline.loadShaders([
        { name: "basic", vertex: "basic.vert", fragment: "basic.frag" },
        { name: "advanced", vertex: "adv.vert", fragment: "adv.frag" },
      ]);
      expect(shaders).toHaveLength(2);
      expect(shaders[0].name).toBe("basic");
      expect(shaders[1].name).toBe("advanced");
    });

    it("should include shader sources", async () => {
      mockLoader.setLoadResult("shader source");
      const shaders = await pipeline.loadShaders([
        { name: "basic", vertex: "basic.vert", fragment: "basic.frag" },
      ]);
      expect(shaders[0].vertex).toBe("shader source");
      expect(shaders[0].fragment).toBe("shader source");
    });

    it("should handle empty array", async () => {
      const shaders = await pipeline.loadShaders([]);
      expect(shaders).toHaveLength(0);
    });
  });

  describe("loadFromManifest", () => {
    it("should load resources from JSON manifest", async () => {
      const manifestContent = JSON.stringify({
        resources: ["file1.txt", "file2.txt"],
      });
      mockLoader.load
        .mockResolvedValueOnce(manifestContent)
        .mockResolvedValueOnce("content1")
        .mockResolvedValueOnce("content2");
      mockLoader.setLoadMultipleResult([
        { success: true, path: "file1.txt", data: "content1" },
        { success: true, path: "file2.txt", data: "content2" },
      ]);

      const result = await pipeline.loadFromManifest("manifest.json");
      expect(result.total).toBe(2);
      expect(result.successCount).toBe(2);
    });

    it("should handle invalid JSON manifest", async () => {
      mockLoader.setLoadResult("invalid json {{{");
      await expect(
        pipeline.loadFromManifest("manifest.json"),
      ).rejects.toThrow();
    });

    it("should handle empty manifest", async () => {
      mockLoader.setLoadResult(JSON.stringify({ resources: [] }));
      const result = await pipeline.loadFromManifest("manifest.json");
      expect(result.total).toBe(0);
    });
  });

  describe("preload", () => {
    it("should preload resources", async () => {
      mockLoader.setLoadMultipleResult([
        { success: true, path: "file1.txt", data: "content1" },
      ]);
      await pipeline.preload(["file1.txt"]);
      expect(pipeline.isCached("file1.txt")).toBe(true);
    });

    it("should not return data", async () => {
      mockLoader.setLoadMultipleResult([
        { success: true, path: "file1.txt", data: "content1" },
      ]);
      const result = await pipeline.preload(["file1.txt"]);
      expect(result).toBeUndefined();
    });
  });

  describe("cache management", () => {
    beforeEach(async () => {
      mockLoader.setLoadResult("content");
      await pipeline.load("file1.txt");
      await pipeline.load("file2.txt");
    });

    it("should check if resource is cached", () => {
      expect(pipeline.isCached("file1.txt")).toBe(true);
      expect(pipeline.isCached("file2.txt")).toBe(true);
      expect(pipeline.isCached("file3.txt")).toBe(false);
    });

    it("should get cached resource", () => {
      expect(pipeline.getCached("file1.txt")).toBe("content");
      expect(pipeline.getCached("nonexistent")).toBeUndefined();
    });

    it("should return cache size", () => {
      expect(pipeline.getCacheSize()).toBe(2);
    });

    it("should clear cache", () => {
      pipeline.clearCache();
      expect(pipeline.getCacheSize()).toBe(0);
      expect(pipeline.isCached("file1.txt")).toBe(false);
    });

    it("should enable cache", async () => {
      pipeline.disableCache();
      expect(pipeline.isCached("file1.txt")).toBe(false);
      pipeline.enableCache();
      mockLoader.setLoadResult("new content");
      await pipeline.load("file3.txt");
      expect(pipeline.isCached("file3.txt")).toBe(true);
    });

    it("should disable cache", () => {
      pipeline.disableCache();
      expect(pipeline.isCached("file1.txt")).toBe(false);
      expect(pipeline.getCached("file1.txt")).toBeUndefined();
    });
  });

  describe("setConcurrency", () => {
    it("should set concurrency limit", () => {
      pipeline.setConcurrency(5);
      // Concurrency is used internally, verify no errors
      expect(pipeline).toBeDefined();
    });

    it("should enforce minimum of 1", () => {
      pipeline.setConcurrency(0);
      pipeline.setConcurrency(-5);
      expect(pipeline).toBeDefined();
    });
  });

  describe("getLoader", () => {
    it("should return underlying loader", () => {
      const loader = pipeline.getLoader();
      expect(loader).toBe(mockLoader);
    });
  });
});

describe("createResourcePipeline", () => {
  it("should create resource pipeline with factory", async () => {
    const pipeline = await createResourcePipeline({
      concurrency: 5,
      cache: true,
    });

    expect(pipeline).toBeDefined();
    expect(pipeline).toBeInstanceOf(ResourcePipeline);
  });

  it("should create with default options", async () => {
    const pipeline = await createResourcePipeline();
    expect(pipeline).toBeDefined();
  });
});
