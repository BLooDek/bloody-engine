import { describe, it, expect, beforeEach, vi } from "vitest";
import { NodeResourceLoader } from "./node-resource-loader";
import * as fs from "fs/promises";
import * as path from "path";

// Mock fs.promises
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  access: vi.fn(),
  stat: vi.fn(),
  readdir: vi.fn(),
  constants: {
    F_OK: 0,
  },
}));

describe("NodeResourceLoader", () => {
  let loader: NodeResourceLoader;
  let mockReadFile: any;
  let mockAccess: any;
  let mockStat: any;
  let mockReaddir: any;

  beforeEach(() => {
    // Get mocked functions
    mockReadFile = fs.readFile as any;
    mockAccess = fs.access as any;
    mockStat = fs.stat as any;
    mockReaddir = fs.readdir as any;

    // Clear all mocks
    vi.clearAllMocks();

    // Create loader with test base directory
    loader = new NodeResourceLoader("/test/base");
  });

  describe("Construction", () => {
    it("should use provided base directory", () => {
      const customLoader = new NodeResourceLoader("/custom/base");

      expect(customLoader.getBaseDir()).toBe("/custom/base");
    });

    it("should use current working directory if no baseDir provided", () => {
      const cwdLoader = new NodeResourceLoader();

      expect(cwdLoader.getBaseDir()).toBeDefined();
      expect(typeof cwdLoader.getBaseDir()).toBe("string");
    });
  });

  describe("Base Directory Management", () => {
    it("should get current base directory", () => {
      expect(loader.getBaseDir()).toBe("/test/base");
    });

    it("should set new base directory", () => {
      loader.setBaseDir("/new/base");

      expect(loader.getBaseDir()).toBe("/new/base");
    });
  });

  describe("load", () => {
    it("should load file with UTF-8 encoding by default", async () => {
      const content = "file content";
      mockReadFile.mockResolvedValue(content);

      const result = await loader.load("test.txt");

      expect(result).toBe(content);
      expect(mockReadFile).toHaveBeenCalledWith(
        path.normalize("/test/base/test.txt"),
        "utf-8",
      );
    });

    it("should load file with custom encoding", async () => {
      const content = "file content";
      mockReadFile.mockResolvedValue(content);

      const result = await loader.load("test.txt", { encoding: "latin1" });

      expect(result).toBe(content);
      expect(mockReadFile).toHaveBeenCalledWith(
        path.normalize("/test/base/test.txt"),
        "latin1",
      );
    });

    it("should resolve absolute paths correctly", async () => {
      const content = "file content";
      mockReadFile.mockResolvedValue(content);

      await loader.load("/absolute/path/test.txt");

      expect(mockReadFile).toHaveBeenCalledWith(
        path.normalize("/absolute/path/test.txt"),
        "utf-8",
      );
    });

    it("should resolve relative paths against base directory", async () => {
      const content = "file content";
      mockReadFile.mockResolvedValue(content);

      await loader.load("relative/test.txt");

      expect(mockReadFile).toHaveBeenCalledWith(
        path.normalize("/test/base/relative/test.txt"),
        "utf-8",
      );
    });

    it("should throw helpful error for ENOENT", async () => {
      const error: any = new Error("File not found");
      error.code = "ENOENT";
      mockReadFile.mockRejectedValue(error);

      await expect(loader.load("missing.txt")).rejects.toThrow(
        `File not found: ${path.normalize("/test/base/missing.txt")} (resolved from: missing.txt)`,
      );
    });

    it("should throw helpful error for EACCES", async () => {
      const error: any = new Error("Permission denied");
      error.code = "EACCES";
      mockReadFile.mockRejectedValue(error);

      await expect(loader.load("protected.txt")).rejects.toThrow(
        `Permission denied reading file: ${path.normalize("/test/base/protected.txt")}`,
      );
    });

    it("should throw helpful error for EISDIR", async () => {
      const error: any = new Error("Is a directory");
      error.code = "EISDIR";
      mockReadFile.mockRejectedValue(error);

      await expect(loader.load("directory")).rejects.toThrow(
        `Path is a directory, not a file: ${path.normalize("/test/base/directory")}`,
      );
    });

    it("should throw generic error for other errors", async () => {
      const error = new Error("Some other error");
      mockReadFile.mockRejectedValue(error);

      await expect(loader.load("test.txt")).rejects.toThrow(
        `Failed to load resource from ${path.normalize("/test/base/test.txt")}: Some other error`,
      );
    });

    it("should throw generic error for non-Error throws", async () => {
      mockReadFile.mockRejectedValue("string error");

      await expect(loader.load("test.txt")).rejects.toThrow(
        `Failed to load resource from ${path.normalize("/test/base/test.txt")}: Unknown error`,
      );
    });

    it("should throw unknown error message for error without message", async () => {
      const error = new Error(""); // Error with empty message
      mockReadFile.mockRejectedValue(error);

      await expect(loader.load("test.txt")).rejects.toThrow(
        `Failed to load resource from ${path.normalize("/test/base/test.txt")}: `,
      );
    });
  });

  describe("loadMultiple", () => {
    it("should load multiple files in parallel", async () => {
      mockReadFile
        .mockResolvedValueOnce("content1")
        .mockResolvedValueOnce("content2")
        .mockResolvedValueOnce("content3");

      const results = await loader.loadMultiple(["file1.txt", "file2.txt", "file3.txt"]);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        data: "content1",
        path: "file1.txt",
        success: true,
      });
      expect(results[1]).toEqual({
        data: "content2",
        path: "file2.txt",
        success: true,
      });
      expect(results[2]).toEqual({
        data: "content3",
        path: "file3.txt",
        success: true,
      });
    });

    it("should handle mixed success and failure", async () => {
      const error: any = new Error("Not found");
      error.code = "ENOENT";

      mockReadFile
        .mockResolvedValueOnce("content1")
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce("content3");

      const results = await loader.loadMultiple(["file1.txt", "file2.txt", "file3.txt"]);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[0].data).toBe("content1");

      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain("File not found");

      expect(results[2].success).toBe(true);
      expect(results[2].data).toBe("content3");
    });

    it("should return results in original order", async () => {
      // Resolve in reverse order to verify ordering
      mockReadFile
        .mockImplementation(() => new Promise((resolve) => {
          setTimeout(() => resolve("content"), Math.random() * 10);
        }));

      const results = await loader.loadMultiple(["a.txt", "b.txt", "c.txt"]);

      expect(results[0].path).toBe("a.txt");
      expect(results[1].path).toBe("b.txt");
      expect(results[2].path).toBe("c.txt");
    });

    it("should use custom encoding for all files", async () => {
      mockReadFile.mockResolvedValue("content");

      await loader.loadMultiple(["file1.txt", "file2.txt"], { encoding: "ascii" });

      expect(mockReadFile).toHaveBeenCalledTimes(2);
      expect(mockReadFile).toHaveBeenCalledWith(
        path.normalize("/test/base/file1.txt"),
        "ascii",
      );
      expect(mockReadFile).toHaveBeenCalledWith(
        path.normalize("/test/base/file2.txt"),
        "ascii",
      );
    });

    it("should handle empty array", async () => {
      const results = await loader.loadMultiple([]);

      expect(results).toHaveLength(0);
      expect(mockReadFile).not.toHaveBeenCalled();
    });
  });

  describe("canLoad", () => {
    it("should accept Unix absolute paths", () => {
      expect(loader.canLoad("/absolute/path")).toBe(true);
      expect(loader.canLoad("/")).toBe(true);
    });

    it("should accept Windows absolute paths", () => {
      expect(loader.canLoad("C:\\path")).toBe(true);
      expect(loader.canLoad("D:\\")).toBe(true);
      expect(loader.canLoad("Z:\\folder\\file.txt")).toBe(true);
    });

    it("should accept relative paths with ./ prefix", () => {
      expect(loader.canLoad("./relative")).toBe(true);
      expect(loader.canLoad("./path/to/file")).toBe(true);
    });

    it("should accept relative paths with ../ prefix", () => {
      expect(loader.canLoad("../parent")).toBe(true);
      expect(loader.canLoad("../../parent/file")).toBe(true);
    });

    it("should accept relative paths without prefix", () => {
      expect(loader.canLoad("shaders/")).toBe(true);
      expect(loader.canLoad("textures/file.png")).toBe(true);
      expect(loader.canLoad("data/config.json")).toBe(true);
    });

    it("should reject invalid paths", () => {
      expect(loader.canLoad("")).toBe(false);
      expect(loader.canLoad("filename")).toBe(false);
      expect(loader.canLoad("filename.txt")).toBe(false);
    });
  });

  describe("exists", () => {
    it("should return true when file exists", async () => {
      mockAccess.mockResolvedValue(undefined);

      const result = await loader.exists("test.txt");

      expect(result).toBe(true);
      expect(mockAccess).toHaveBeenCalledWith(
        path.normalize("/test/base/test.txt"),
        fs.constants.F_OK,
      );
    });

    it("should return false when file does not exist", async () => {
      mockAccess.mockRejectedValue(new Error("Not found"));

      const result = await loader.exists("missing.txt");

      expect(result).toBe(false);
    });

    it("should resolve absolute paths", async () => {
      mockAccess.mockResolvedValue(undefined);

      await loader.exists("/absolute/path/test.txt");

      expect(mockAccess).toHaveBeenCalledWith(
        path.normalize("/absolute/path/test.txt"),
        fs.constants.F_OK,
      );
    });
  });

  describe("getStats", () => {
    it("should return file stats", async () => {
      const mockStats = {
        size: 1024,
        mtime: new Date(),
        isFile: () => true,
        isDirectory: () => false,
      };
      mockStat.mockResolvedValue(mockStats);

      const stats = await loader.getStats("test.txt");

      expect(stats).toBe(mockStats);
      expect(mockStat).toHaveBeenCalledWith(
        path.normalize("/test/base/test.txt"),
      );
    });

    it("should resolve absolute paths", async () => {
      const mockStats = { size: 512 };
      mockStat.mockResolvedValue(mockStats);

      await loader.getStats("/absolute/path/test.txt");

      expect(mockStat).toHaveBeenCalledWith(
        path.normalize("/absolute/path/test.txt"),
      );
    });

    it("should propagate errors from fs.stat", async () => {
      const error = new Error("Stat failed");
      mockStat.mockRejectedValue(error);

      await expect(loader.getStats("test.txt")).rejects.toThrow("Stat failed");
    });
  });

  describe("listDirectory", () => {
    it("should list files in directory (non-recursive)", async () => {
      const mockEntries = [
        { name: "file1.txt", isFile: () => true, isDirectory: () => false },
        { name: "file2.txt", isFile: () => true, isDirectory: () => false },
        { name: "subdir", isFile: () => false, isDirectory: () => true },
      ];
      mockReaddir.mockResolvedValue(mockEntries);

      const files = await loader.listDirectory("/test/dir", false);

      expect(files).toHaveLength(2);
      expect(files).toContain(path.normalize("/test/dir/file1.txt"));
      expect(files).toContain(path.normalize("/test/dir/file2.txt"));
      expect(mockReaddir).toHaveBeenCalledWith(
        path.normalize("/test/dir"),
        { withFileTypes: true },
      );
    });

    it("should list files recursively", async () => {
      const mockEntries = [
        { name: "file1.txt", isFile: () => true, isDirectory: () => false },
        { name: "subdir", isFile: () => false, isDirectory: () => true },
      ];
      const mockSubEntries = [
        { name: "file2.txt", isFile: () => true, isDirectory: () => false },
      ];

      mockReaddir
        .mockResolvedValueOnce(mockEntries)
        .mockResolvedValueOnce(mockSubEntries);

      const files = await loader.listDirectory("/test/dir", true);

      expect(files).toHaveLength(2);
      expect(files).toContain(path.normalize("/test/dir/file1.txt"));
      expect(files).toContain(path.normalize("/test/dir/subdir/file2.txt"));
    });

    it("should handle empty directory", async () => {
      mockReaddir.mockResolvedValue([]);

      const files = await loader.listDirectory("/test/empty");

      expect(files).toHaveLength(0);
    });

    it("should resolve relative paths", async () => {
      const mockEntries = [
        { name: "file.txt", isFile: () => true, isDirectory: () => false },
      ];
      mockReaddir.mockResolvedValue(mockEntries);

      await loader.listDirectory("relative/dir");

      expect(mockReaddir).toHaveBeenCalledWith(
        path.normalize("/test/base/relative/dir"),
        { withFileTypes: true },
      );
    });

    it("should propagate errors from fs.readdir", async () => {
      const error = new Error("Directory not found");
      mockReaddir.mockRejectedValue(error);

      await expect(loader.listDirectory("/missing")).rejects.toThrow(
        "Directory not found",
      );
    });

    it("should default to non-recursive", async () => {
      const mockEntries = [
        { name: "file.txt", isFile: () => true, isDirectory: () => false },
      ];
      mockReaddir.mockResolvedValue(mockEntries);

      await loader.listDirectory("/test/dir");

      expect(mockReaddir).toHaveBeenCalledTimes(1);
    });
  });

  describe("resolvePath (private behavior verification)", () => {
    it("should normalize paths correctly", async () => {
      mockReadFile.mockResolvedValue("content");

      await loader.load("./test/../file.txt");

      expect(mockReadFile).toHaveBeenCalledWith(
        path.normalize("/test/base/file.txt"),
        "utf-8",
      );
    });

    it("should handle trailing slashes", async () => {
      mockReadFile.mockResolvedValue("content");

      await loader.load("dir//file.txt");

      expect(mockReadFile).toHaveBeenCalledWith(
        path.normalize("/test/base/dir/file.txt"),
        "utf-8",
      );
    });
  });
});
