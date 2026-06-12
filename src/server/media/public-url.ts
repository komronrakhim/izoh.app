import { LOCAL_MEDIA_BUCKET } from "./local-storage";
import { getR2Config } from "./r2-client";

type MediaPublicUrlAsset = {
  bucket: string;
  public_url: string;
  storage_key: string;
};

const encodeStorageKey = (storageKey: string) =>
  storageKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export const getMediaPublicUrl = (asset: MediaPublicUrlAsset) => {
  if (asset.bucket === LOCAL_MEDIA_BUCKET) {
    return asset.public_url;
  }

  return `${getR2Config().publicBaseUrl}/${encodeStorageKey(asset.storage_key)}`;
};
