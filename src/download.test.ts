import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { combineStrings, extractNonSkylinkPath } from "../utils/testing";

import { SkynetClient, defaultSkynetPortalUrl } from "./index";

const portalUrl = defaultSkynetPortalUrl;
const hnsLink = "foo";
const client = new SkynetClient(portalUrl);
const skylink = "XABvi7JtJbQSMAcDwnUnmp2FKDPjg8_tTTFP4BwMSxVdEg";
const skylinkBase32 = "bg06v2tidkir84hg0s1s4t97jaeoaa1jse1svrad657u070c9calq4g";

const validSkylinkVariations = combineStrings(
  ["", "sia:", "sia://", "https://siasky.net/", "https://foo.siasky.net/", `https://${skylinkBase32}.siasky.net/`],
  [skylink],
  ["", "/", "//", "/foo", "/foo/", "/foo/bar", "/foo/bar/"],
  ["", "?", "?foo=bar", "?foo=bar&bar=baz"],
  ["", "#", "#foo", "#foo?bar"]
);
const validHnsLinkVariations = [hnsLink, `hns:${hnsLink}`, `hns://${hnsLink}`];
const validHnsresLinkVariations = [hnsLink, `hnsres:${hnsLink}`, `hnsres://${hnsLink}`];

const attachment = "?attachment=true";
const expectedUrl = `${portalUrl}/${skylink}`;
const expectedHnsUrl = `${portalUrl}/hns/${hnsLink}`;
const expectedHnsUrlSubdomain = `https://${hnsLink}.hns.siasky.net`;
const expectedHnsresUrl = `${portalUrl}/hnsres/${hnsLink}`;

const mockLocationAssign = jest.fn();
Object.defineProperty(window, "location", {
  value: {
    assign: mockLocationAssign,
  },
  writable: true,
});

describe("downloadFile", () => {
  it.each(validSkylinkVariations)("should download with attachment set from skylink %s", (fullSkylink) => {
    mockLocationAssign.mockClear();
    const url = client.downloadFile(fullSkylink);

    const path = extractNonSkylinkPath(fullSkylink, skylink);

    let fullExpectedUrl = `${expectedUrl}${path}${attachment}`;
    // Change ?attachment=true to &attachment=true if need be.
    if ((fullExpectedUrl.match(/\?/g) || []).length > 1) {
      fullExpectedUrl = fullExpectedUrl.replace(attachment, "&attachment=true");
    }

    expect(url).toEqual(fullExpectedUrl);
    expect(mockLocationAssign).toHaveBeenCalledWith(fullExpectedUrl);
  });

  it("should download with the optional path being correctly URI-encoded", () => {
    const url = client.downloadFile(skylink, { path: "dir/test?encoding" });

    expect(url).toEqual(`${expectedUrl}/dir/test%3Fencoding${attachment}`);
  });

  it("should download with query parameters being appended to the URL", () => {
    const url = client.downloadFile(skylink, { query: { name: "test" } });

    expect(url).toEqual(`${expectedUrl}?name=test&attachment=true`);
  });
});

describe("downloadFileHns", () => {
  it.each(validHnsLinkVariations)("should download with the correct link using hns link %s", async (input) => {
    const url = await client.downloadFileHns(input);

    expect(url).toEqual(`${expectedHnsUrl}${attachment}`);
  });
});

describe("getHnsUrl", () => {
  it.each(validHnsLinkVariations)("should return correctly formed hns URL using hns link %s", (input) => {
    expect(client.getHnsUrl(input)).toEqual(expectedHnsUrl);
    expect(client.getHnsUrl(input, { subdomain: true })).toEqual(expectedHnsUrlSubdomain);
  });

  it("should return correctly formed hns URL with forced download", () => {
    const url = client.getHnsUrl(hnsLink, { download: true });

    expect(url).toEqual(`${expectedHnsUrl}${attachment}`);
  });
});

describe("getHnsresUrl", () => {
  it.each(validHnsresLinkVariations)("should return correctly formed hnsres URL using hnsres link %s", (input) => {
    expect(client.getHnsresUrl(input)).toEqual(expectedHnsresUrl);
  });
});

describe("getSkylinkUrl", () => {
  const expectedUrl = `${portalUrl}/${skylink}`;

  it.each(validSkylinkVariations)("should return correctly formed skylink URL using skylink %s", (fullSkylink) => {
    const path = extractNonSkylinkPath(fullSkylink, skylink);

    expect(client.getSkylinkUrl(fullSkylink)).toEqual(`${expectedUrl}${path}`);
  });

  it("should return correctly formed URLs when path is given", () => {
    expect(client.getSkylinkUrl(skylink, { path: "foo/bar" })).toEqual(`${expectedUrl}/foo/bar`);
    expect(client.getSkylinkUrl(skylink, { path: "foo?bar" })).toEqual(`${expectedUrl}/foo%3Fbar`);
  });

  it("should return correctly formed URL with forced download", () => {
    const url = client.getSkylinkUrl(skylink, { download: true, endpointPath: "skynet/skylink" });

    expect(url).toEqual(`${portalUrl}/skynet/skylink/${skylink}${attachment}`);
  });

  it("should return correctly formed URLs with forced download and path", () => {
    expect(client.getSkylinkUrl(skylink, { download: true, path: "foo?bar" })).toEqual(
      `${expectedUrl}/foo%3Fbar${attachment}`
    );
  });

  const expectedBase32 = `https://${skylinkBase32}.siasky.net`;

  it.each(validSkylinkVariations)("should convert base64 skylink to base32 using skylink %s", (fullSkylink) => {
    const path = extractNonSkylinkPath(fullSkylink, skylink);
    const url = client.getSkylinkUrl(fullSkylink, { subdomain: true });

    expect(url).toEqual(`${expectedBase32}${path}`);
  });
});

describe("getMetadata", () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  const skynetFileMetadata = { filename: "sia.pdf" };
  const headersFull = { "skynet-skylink": skylink, "skynet-file-metadata": JSON.stringify(skynetFileMetadata) };

  it.each(validSkylinkVariations)(
    "should successfully fetch skynet file headers from skylink %s",
    async (fullSkylink) => {
      const skylinkUrl = client.getSkylinkUrl(fullSkylink);
      mock.onHead(skylinkUrl).reply(200, {}, headersFull);

      const responseMetadata = await client.getMetadata(fullSkylink);

      expect(responseMetadata).toEqual(skynetFileMetadata);
    }
  );

  const headersEmpty = { "skynet-skylink": skylink };

  it.each(validSkylinkVariations)(
    "should fail quietly when skynet headers not present using skylink %s",
    async (fullSkylink) => {
      const skylinkUrl = client.getSkylinkUrl(fullSkylink);
      mock.onHead(skylinkUrl).reply(200, {}, headersEmpty);

      const responseMetadata = await client.getMetadata(fullSkylink);

      expect(responseMetadata).toEqual({});
    }
  );
});

describe("openFile", () => {
  const windowOpen = jest.spyOn(window, "open").mockImplementation();

  it.each(validSkylinkVariations)(
    "should call window.openFile when calling openFile with skylink %s",
    (fullSkylink) => {
      windowOpen.mockReset();

      const path = extractNonSkylinkPath(fullSkylink, skylink);
      client.openFile(fullSkylink);

      expect(windowOpen).toHaveBeenCalledTimes(1);
      expect(windowOpen).toHaveBeenCalledWith(`${expectedUrl}${path}`, "_blank");
    }
  );
});

describe("downloadFileHns", () => {
  it("should set domain with the portal and hns link and then call window.openFile with attachment set", async () => {
    for (const input of validHnsLinkVariations) {
      mockLocationAssign.mockClear();

      await client.downloadFileHns(input);

      expect(mockLocationAssign).toHaveBeenCalledWith("https://siasky.net/hns/foo?attachment=true");
    }
  });
});

describe("openFileHns", () => {
  const hnsUrl = `${portalUrl}/hns/${hnsLink}`;
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  it("should set domain with the portal and hns link and then call window.openFile", async () => {
    const windowOpen = jest.spyOn(window, "open").mockImplementation();

    for (const input of validHnsLinkVariations) {
      mock.resetHistory();
      windowOpen.mockReset();

      await client.openFileHns(input);

      expect(mock.history.get.length).toBe(0);

      expect(windowOpen).toHaveBeenCalledTimes(1);
      expect(windowOpen).toHaveBeenCalledWith(hnsUrl, "_blank");
    }
  });
});

describe("resolveHns", () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    mock.onGet(expectedHnsresUrl).reply(200, { skylink: skylink });
  });

  it("should call axios.get with the portal and hnsres link and return the json body", async () => {
    for (const input of validHnsresLinkVariations) {
      mock.resetHistory();

      const data = await client.resolveHns(input);

      expect(mock.history.get.length).toBe(1);
      expect(data.skylink).toEqual(skylink);
    }
  });
});
