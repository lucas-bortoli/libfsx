export enum IFileSystemNodeType {
  File = 0,
  Directory = 1,
}

export interface IFileSystemNode {
  name: string;
  type: IFileSystemNodeType;
}

export interface IFileSystemFile extends IFileSystemNode {
  type: IFileSystemNodeType.File;
  size: number;
  creationDate: number;
  metaUrl: string;
}

export interface IFileSystemDirectory extends IFileSystemNode {
  type: IFileSystemNodeType.Directory;
  children: IFileSystemNode[];
}

export type FileChunk = {
  size: number;
  link: string;
  iv: Uint8Array;
};

export type FileSystemHeaders =
  | "FileSystem-Version"
  | "Use-Encryption"
  | "Encryption-Salt"
  | "Encryption-Key-Hash"
  | "Description"
  | "Creation-Date"
  | "Tags";
