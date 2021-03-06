import { SkynetClient } from "./client";
import {
  addSubdomain,
  addUrlQuery,
  convertSkylinkToBase32,
  defaultOptions,
  makeUrl,
  parseSkylink,
  trimUriPrefix,
  uriHandshakePrefix,
  uriHandshakeResolverPrefix,
} from "./utils";

const defaultDownloadOptions = {
  ...defaultOptions("/"),
};
const defaultDownloadHnsOptions = {
  ...defaultOptions("/hns"),
  hnsSubdomain: "hns",
};
const defaultResolveHnsOptions = {
  ...defaultOptions("/hnsres"),
};

/**
 * Initiates a download of the content of the skylink within the browser.
 * @param skylink - 46 character skylink, possibly followed by a path or query parameters. Note that the skylink will not be encoded, so if your path might contain special characters, consider using `customOptions.path`.
 * @param [customOptions={}] - Additional settings that can optionally be set.
 * @param {string} [customOptions.endpointPath="/"] - The relative URL path of the portal endpoint to contact.
 * @param {string} [customOptions.path=""] - A path to append to the skylink, e.g. `dir1/dir2/file`. A Unix-style path is expected. Each path component will be URL-encoded.
 * @param {Object} [customOptions.query={}] - A query object to convert to a query parameter string and append to the URL.
 * @param {boolean} [customOptions.subdomain=false] - Whether to return the final skylink in subdomain format.
 * @returns {string} - The full URL that was used.
 */
export function downloadFile(this: SkynetClient, skylink: string, customOptions: any = {}): string {
  const opts = { ...defaultDownloadOptions, ...this.customOptions, ...customOptions, download: true };
  const url = this.getSkylinkUrl(skylink, opts);

  // Download the url.
  window.location.assign(url);

  return url;
}

/**
 * Initiates a download of the content of the skylink at the Handshake domain.
 * @param domain - Handshake domain.
 * @param [customOptions={}] - Additional settings that can optionally be set.
 * @param {string} [customOptions.endpointPath="/hns"] - The relative URL path of the portal endpoint to contact.
 * @param {Object} [customOptions.query] - A query object to convert to a query parameter string and append to the URL.
 * @param {boolean} [customOptions.subdomain=false] - Whether to return the final URL with the HNS domain as a subdomain.
 * @returns {string} - The full URL that was used.
 */
export async function downloadFileHns(this: SkynetClient, domain: string, customOptions: any = {}): Promise<string> {
  const opts = { ...defaultDownloadHnsOptions, ...this.customOptions, ...customOptions, download: true };
  const url = this.getHnsUrl(domain, opts);

  // Download the url.
  window.location.assign(url);

  return url;
}

export function getSkylinkUrl(this: SkynetClient, skylinkStr: string, customOptions: any = {}): string {
  const opts = { ...defaultDownloadOptions, ...this.customOptions, ...customOptions };
  const query = opts.query ?? {};
  if (opts.download) {
    query.attachment = true;
  }

  // URL-encode the path.
  let path = "";
  if (opts.path) {
    if (typeof opts.path !== "string") {
      throw new Error(`opts.path has to be a string, ${typeof opts.path} provided`);
    }
    // Encode each element of the path separately and join them.
    //
    // Don't use encodeURI because it does not encode characters such as '?'
    // etc. These are allowed as filenames on Skynet and should be encoded so
    // they are not treated as URL separators.
    path = opts.path
      .split("/")
      .map((element: string) => encodeURIComponent(element))
      .join("/");
  }

  // TODO: fix subdomain + includePath
  let url;
  if (opts.subdomain) {
    // Get the path from the skylink.
    const skylinkPath = parseSkylink(skylinkStr, { onlyPath: true });
    // Get just the skylink.
    let skylink = parseSkylink(skylinkStr);
    if (skylink === null) {
      throw new Error(`Could not get skylink out of input '${skylinkStr}'`);
    }
    // Convert the skylink (without the path) to base32.
    skylink = convertSkylinkToBase32(skylink);
    url = addSubdomain(this.portalUrl, skylink);
    url = makeUrl(url, skylinkPath, path);
  } else {
    // Get the skylink including the path.
    const skylink = parseSkylink(skylinkStr, { includePath: true });
    if (skylink === null) {
      throw new Error(`Could not get skylink out of input '${skylinkStr}'`);
    }
    // Add additional path if passed in.
    url = makeUrl(this.portalUrl, opts.endpointPath, skylink, path);
  }
  return addUrlQuery(url, query);
}

export function getHnsUrl(this: SkynetClient, domain: string, customOptions: any = {}): string {
  const opts = { ...defaultDownloadHnsOptions, ...this.customOptions, ...customOptions };
  const query = opts.query ?? {};
  if (opts.download) {
    query.attachment = true;
  }

  domain = trimUriPrefix(domain, uriHandshakePrefix);
  const url = opts.subdomain
    ? addSubdomain(addSubdomain(this.portalUrl, opts.hnsSubdomain), domain)
    : makeUrl(this.portalUrl, opts.endpointPath, domain);
  return addUrlQuery(url, query);
}

export function getHnsresUrl(this: SkynetClient, domain: string, customOptions: any = {}): string {
  const opts = { ...defaultResolveHnsOptions, ...this.customOptions, ...customOptions };

  domain = trimUriPrefix(domain, uriHandshakeResolverPrefix);
  return makeUrl(this.portalUrl, opts.endpointPath, domain);
}

export async function getMetadata(this: SkynetClient, skylink: string, customOptions: any = {}) {
  const opts = { ...defaultDownloadOptions, ...this.customOptions, ...customOptions };
  const url = this.getSkylinkUrl(skylink, opts);

  try {
    const response = await this.executeRequest({
      ...opts,
      method: "head",
      url,
    });

    return response.headers["skynet-file-metadata"] ? JSON.parse(response.headers["skynet-file-metadata"]) : {};
  } catch (error) {
    throw new Error("Error getting skynet-file-metadata from skylink");
  }
}

/**
 * Opens the content of the skylink within the browser.
 * @param skylink - 46 character skylink.
 * @param [customOptions={}] - Additional settings that can optionally be set.. See `downloadFile` for the full list.
 * @param {string} [customOptions.endpointPath="/"] - The relative URL path of the portal endpoint to contact.
 * @returns - The full URL that was used.
 */
export function openFile(this: SkynetClient, skylink: string, customOptions = {}): string {
  const opts = { ...defaultDownloadOptions, ...this.customOptions, ...customOptions };
  const url = this.getSkylinkUrl(skylink, opts);

  window.open(url, "_blank");

  return url;
}

/**
 * Opens the content of the skylink from the given Handshake domain within the browser.
 * @param domain - Handshake domain.
 * @param [customOptions={}] - Additional settings that can optionally be set. See `downloadFileHns` for the full list.
 * @param {string} [customOptions.endpointPath="/hns"] - The relative URL path of the portal endpoint to contact.
 * @returns {string} - The full URL that was used.
 */
export async function openFileHns(this: SkynetClient, domain: string, customOptions = {}): Promise<string> {
  const opts = { ...defaultDownloadHnsOptions, ...this.customOptions, ...customOptions };
  const url = this.getHnsUrl(domain, opts);

  // Open the url in a new tab.
  window.open(url, "_blank");

  return url;
}

/**
 * @param domain - Handshake resolver domain.
 * @param [customOptions={}] - Additional settings that can optionally be set.
 * @param {string} [customOptions.endpointPath="/hnsres"] - The relative URL path of the portal endpoint to contact.
 * @param {Object} [customOptions.query] - A query object to convert to a query parameter string and append to the URL.
 */
export async function resolveHns(this: SkynetClient, domain: string, customOptions = {}): Promise<any> {
  const opts = { ...defaultResolveHnsOptions, ...this.customOptions, ...customOptions };
  const url = this.getHnsresUrl(domain, opts);

  // Get the txt record from the hnsres domain on the portal.
  const response = await this.executeRequest({
    ...opts,
    method: "get",
    url,
  });

  return response.data;
}
