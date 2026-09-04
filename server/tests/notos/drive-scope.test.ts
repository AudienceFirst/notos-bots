// NOTOS: de Drive-klantenmap als grens van elke leesactie (bouwplan stap 8).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  callTool,
  forgetTrees,
  parentsClause,
} from "../../src/plugins/google-drive-rest";
import { driveFolderIdFrom, driveRootsOf } from "../../src/notos/workspaces";

const realFetch = globalThis.fetch;
let urls: string[] = [];

/** A tiny Drive: root1 holds sub1; sub1 holds doc_in; doc_out lives elsewhere. */
function stubDrive() {
  urls = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    urls.push(url.toString());
    const q = url.searchParams.get("q") ?? "";
    let body: unknown = {};
    if (url.pathname.endsWith("/files")) {
      if (q.includes("mimeType = 'application/vnd.google-apps.folder'")) {
        body = q.startsWith("'root1'")
          ? { files: [{ id: "sub1" }] }
          : { files: [] };
      } else {
        body = {
          files: [
            {
              id: "doc_in",
              name: "Briefing",
              mimeType: "text/plain",
              modifiedTime: "2026-09-01T00:00:00Z",
            },
          ],
        };
      }
    } else if (url.pathname.endsWith("/files/doc_in")) {
      body =
        url.searchParams.get("alt") === "media"
          ? "de tekst"
          : {
              id: "doc_in",
              name: "Briefing",
              mimeType: "text/plain",
              parents: ["sub1"],
            };
    } else if (url.pathname.endsWith("/files/doc_out")) {
      body = {
        id: "doc_out",
        name: "Elders",
        mimeType: "text/plain",
        parents: ["other"],
      };
    }
    return new Response(
      typeof body === "string" ? body : JSON.stringify(body),
      {
        status: 200,
        headers: {
          "content-type":
            typeof body === "string" ? "text/plain" : "application/json",
        },
      },
    );
  }) as typeof fetch;
}

const scoped = {
  url: "https://www.googleapis.com/drive/v3",
  token: "t",
  driveRootIds: ["root1"],
};

beforeEach(() => {
  forgetTrees();
  stubDrive();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("the client folder is the whole of Drive for a Bot", () => {
  test("a search carries the folder tree, root and subfolders, as its parents clause", async () => {
    const result = await callTool(scoped, "search_files", {
      query: "briefing",
    });
    expect(result.isError).toBe(false);
    expect(result.text).toContain("Briefing");
    const search = urls.find((u) => u.includes("fullText"));
    expect(search).toBeDefined();
    const q = new URL(search as string).searchParams.get("q") ?? "";
    expect(q).toContain(parentsClause(["root1", "sub1"]));
    expect(q).toContain("trashed = false");
  });

  test("the tree is walked once and kept", async () => {
    await callTool(scoped, "list_recent_files", {});
    const walks = urls.filter((u) =>
      u.includes("vnd.google-apps.folder"),
    ).length;
    await callTool(scoped, "list_recent_files", {});
    expect(
      urls.filter((u) => u.includes("vnd.google-apps.folder")).length,
    ).toBe(walks);
  });

  test("a file inside reads; a file outside is refused with the sentence", async () => {
    const inside = await callTool(scoped, "read_file_content", {
      fileId: "doc_in",
    });
    expect(inside.isError).toBe(false);
    expect(inside.text).toContain("de tekst");
    const outside = await callTool(scoped, "read_file_content", {
      fileId: "doc_out",
    });
    expect(outside.isError).toBe(true);
    expect(outside.text).toContain("alleen de klantenmap is doorzoekbaar");
    const meta = await callTool(scoped, "get_file_metadata", {
      fileId: "doc_out",
    });
    expect(meta.isError).toBe(true);
  });

  test("list_folder defaults to the root and refuses a folder outside the tree", async () => {
    const root = await callTool(scoped, "list_folder", {});
    expect(root.isError).toBe(false);
    const elsewhere = await callTool(scoped, "list_folder", {
      folderId: "other",
    });
    expect(elsewhere.isError).toBe(true);
  });

  test("no folder configured is a sentence, not a search of all of Drive", async () => {
    const result = await callTool(
      { ...scoped, driveRootIds: [] },
      "search_files",
      {
        query: "x",
      },
    );
    expect(result.isError).toBe(true);
    expect(result.text).toContain("Admin › Workspaces");
    expect(urls).toHaveLength(0);
  });

  test("folder ids come out of links and out of the jsonb", () => {
    expect(
      driveFolderIdFrom(
        "https://drive.google.com/drive/folders/1GQBl5jSBEvobenpwG74rbCMtJ-uOFos2?usp=x",
      ),
    ).toBe("1GQBl5jSBEvobenpwG74rbCMtJ-uOFos2");
    expect(driveFolderIdFrom("1GQBl5jSBEvobenpwG74rbCMtJ-uOFos2")).toBe(
      "1GQBl5jSBEvobenpwG74rbCMtJ-uOFos2",
    );
    expect(driveFolderIdFrom("not a folder")).toBeNull();
    expect(
      driveRootsOf({ roots: ["1GQBl5jSBEvobenpwG74rbCMtJ-uOFos2", 3, "x"] }),
    ).toEqual(["1GQBl5jSBEvobenpwG74rbCMtJ-uOFos2"]);
    expect(driveRootsOf({})).toEqual([]);
    expect(driveRootsOf(null)).toEqual([]);
  });
});
