/**
 * AST-related type definitions
 */

export interface ASTNode {
  type: string;
  start: number;
  end: number;
}
