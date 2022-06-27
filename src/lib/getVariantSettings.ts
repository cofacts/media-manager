import { MediaType } from '../types';
import { PassThrough } from 'stream';

type GetVariantSettingsOptions = {
  /** Parsed media type */
  type: MediaType;

  /** Original content type from url */
  contentType: string;

  /** File size in byte, read from Content-Length */
  size: number;
};

type VariantSetting = {
  /** The name of variant. Maps to file name under the media entry directory. */
  name: string;

  /** The transform stream that takes file from input stream and outputs the variant file. */
  transform: NodeJS.ReadWriteStream;

  /** The content type of the transform output of this variant. */
  contentType: string;
};

/**
 * @returns The available variants for the given input file type.
 */
function getVariantSettings({ type, contentType }: GetVariantSettingsOptions): VariantSetting[] {
  switch (type) {
    default:
      return [
        {
          name: 'original',
          transform: new PassThrough(),
          contentType, // Mirrors source content type
        },
      ];
  }
}

export default getVariantSettings;
