import { PassThrough } from 'stream';
import { GetVariantSettingsFn, VariantSetting } from '../types';

/**
 * @param contentType - the content type of input file.
 * @param name - See {@link VariantSetting.name}. Defaults to `original`.
 * @returns The variant setting that does a identity transform (no transform at all).
 */
export function original(contentType: string, name: string = 'original'): VariantSetting {
  return {
    name,
    transform: new PassThrough(),
    contentType, // Mirrors source content type
  };
}

/**
 * The default variant setting getter function. It will create just one variant, `original`,
 * no matter what type of file we are currently uploading.
 */
export const defaultGetVariantSettings: GetVariantSettingsFn = ({ contentType }) => [
  original(contentType),
];
