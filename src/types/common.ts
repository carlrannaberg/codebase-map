/**
 * Common type definitions
 */

export interface CodeMapConfig {
  rootPath: string;
  outputPath: string;
  include: string[];
  exclude: string[];
  maxFileSize: number;
  verbose: boolean;
}
