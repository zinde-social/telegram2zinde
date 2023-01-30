import { Contract, NoteMetadataAttachmentBase } from "crossbell.js";
import type { NoteMetadata } from "crossbell.js";
import { ethers } from "ethers";
import { uploadFile, uploadJson } from "./ipfs";
import { Photo } from "@mui/icons-material";

let gContract: Contract | null = null;
let signerAddress: string = "";

let characterId: number = 0;

export const setContractCharacterHandle = async (handle: string) => {
  const res = await fetch(
    `https://indexer.crossbell.io/v1/handles/${handle}/character`
  ).then((res) => res.json());
  characterId = res.characterId;
};

export const initWithPrivateKey = async (privateKey: string) => {
  if (!privateKey) {
    throw new Error("No private key provided");
  }

  if (!privateKey.startsWith("0x")) {
    privateKey = `0x${privateKey}`;
  }

  try {
    // Initialize wallet address
    const w = new ethers.Wallet(privateKey);
    signerAddress = w.address;

    // Initialize contract instance
    gContract = new Contract(privateKey);
    await gContract.connect();
  } catch (e) {
    gContract = null;
    signerAddress = "";
    throw e;
  }
};

const getMetamaskProvider = async (): Promise<Contract> => {
  const provider = (window as any).ethereum;
  const uContract = new Contract(provider);
  await uContract.connect();
  return uContract;
};

export const generateRandomPrivateKey = () => {
  const randWallet = ethers.Wallet.createRandom();
  return randWallet.privateKey;
};

export const getSignerAddress = (): string => {
  if (gContract === null) {
    throw new Error("Contract not initialized.");
  }

  return signerAddress;
};

export const getSignerBalance = async (): Promise<number> => {
  if (gContract === null) {
    throw new Error("Contract not initialized.");
  }

  const { data: csb } = await gContract.getBalance(signerAddress);
  if (csb) {
    return parseInt(csb);
  } else {
    return -1;
  }
};

export const checkOperator = async (): Promise<boolean> => {
  if (gContract === null) {
    throw new Error("Contract not initialized.");
  }

  // Check if is owner
  const characterData = await fetch(
    `https://indexer.crossbell.io/v1/characters/${characterId}`
  ).then((res) => res.json());
  if (signerAddress.toLowerCase() === characterData.owner?.toLowerCase()) {
    // Is owner
    console.log("Signer is owner");
    return true;
  }

  // Otherwise need operator authorization
  const { data: permissions } =
    await gContract.getOperatorPermissionsForCharacter(
      characterId,
      signerAddress
    );

  console.log("Signer permissions: ", permissions);

  return permissions.includes("POST_NOTE");
};

export const addOperator = async () => {
  if (gContract === null) {
    throw new Error("Contract not initialized.");
  }

  // Set operator
  const uProvider = await getMetamaskProvider();
  await uProvider.grantOperatorPermissionsForCharacter(
    characterId,
    signerAddress,
    ["POST_NOTE"]
  );
};

export const removeOperator = async () => {
  if (gContract === null) {
    throw new Error("Contract not initialized.");
  }

  // Remove Operator
  const uProvider = await getMetamaskProvider();
  await uProvider.grantOperatorPermissionsForCharacter(
    characterId,
    signerAddress,
    []
  );
};

export interface TextEntity {
  type: string; // plain / bold / spoiler / italic / strikethrough / link / text_link
  text: string;
  href?: string; // Only type === link
}

interface Photo {
  photo?: string;
  width?: number;
  height?: number;
}

interface Text {
  text: string | (string | TextEntity)[];
  text_entities: TextEntity[];
}

interface TGExportMessageDataWithoutPhoto extends Text {
  id: number;
  type: string; // service / message
  date: string;
  date_unixtime: string;
  actor?: string;
  actor_id?: string;
  action?: string;
  title?: string;

  from?: string;
  from_id?: string;

  file?: string;
  thumbnail?: string;
  mime_type?: string;

  width?: number;
  height?: number;

  media_type?: string; // video_file / voice_message
  duration_seconds?: number;
}

export interface TGExportMessageData
  extends TGExportMessageDataWithoutPhoto,
    Photo {}

export interface TGExportMessageDataWithPhotos
  extends TGExportMessageDataWithoutPhoto {
  photos?: Photo[];
}

export const ParseMessageText = (message: TGExportMessageData): string => {
  if (message.type === "service") {
    return message.action || "";
  }
  // Prepare text
  let content = "";
  for (const entity of message.text_entities) {
    switch (entity.type) {
      // case "plain":
      //   content += entity.text;
      //   break;
      case "bold":
        content += `**${entity.text}**`;
        break;
      case "italic":
        content += `*${entity.text}*`;
        break;
      case "strikethrough":
        content += `~~${entity.text}~~`;
        break;
      case "link":
        content += `[${entity.text}](${entity.text})`;
        break;
      case "text_link":
        content += `[${entity.text}](${entity.href})`;
        break;
      default:
        content += entity.text;
        break;
    }
  }

  return content;
};

export const signerPostNote = async (
  message: TGExportMessageDataWithPhotos,
  channelName: string
) => {
  if (gContract === null) {
    throw new Error("Contract not initialized.");
  }

  // Upload medias to IPFS
  const mediaAttachments: NoteMetadataAttachmentBase<"address">[] = [];
  if (!!message.photos) {
    // Is photo
    for (const photo of message.photos) {
      if (!photo.photo) break;
      const mediaFileName = `${photo.photo.split("/").pop()}`;
      const result = await fetch(photo.photo);
      const blob = await result.blob();
      const ipfsUri = await uploadFile(blob);
      mediaAttachments.push({
        name: mediaFileName,
        address: ipfsUri,
        mime_type: blob.type,
        size_in_bytes: blob.size,
        alt: mediaFileName,
        width: photo.width,
        height: photo.height,
      });
    }
  }

  if (!!message.file) {
    // Has attachment
    const mediaFileName = `${message.file.split("/").pop()}`;
    const result = await fetch(message.file);
    const blob = await result.blob();
    const ipfsUri = await uploadFile(blob);
    mediaAttachments.push({
      name: mediaFileName,
      address: ipfsUri,
      mime_type: message.mime_type || blob.type,
      size_in_bytes: blob.size,
      alt: mediaFileName,
      width: message.width,
      height: message.height,
    });
  }

  // Upload note
  const note: NoteMetadata = {
    type: "note",
    sources: ["T2C", "Telegram"],
    content: ParseMessageText(message),
    attachments: mediaAttachments,
    date_published: new Date(message.date).toISOString(),
    external_urls: channelName
      ? [`https://t.me/${channelName}/${message.id}`]
      : [],
  };

  const noteIPFSUri = await uploadJson(note);

  // Push on chain
  await gContract.postNote(characterId, noteIPFSUri);
};
