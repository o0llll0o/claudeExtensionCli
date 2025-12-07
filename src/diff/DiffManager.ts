import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface CodeChange {
    filePath: string;
    code: string;
    language: string;
}

export class DiffManager {
    private pendingChanges: Map<string, CodeChange> = new Map();

    async showDiff(change: CodeChange): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const fullPath = path.isAbsolute(change.filePath)
            ? change.filePath
            : path.join(workspaceFolder, change.filePath);

        const fileUri = vscode.Uri.file(fullPath);
        
        let originalContent = '';
        try {
            const doc = await vscode.workspace.openTextDocument(fileUri);
            originalContent = doc.getText();
        } catch {
            originalContent = '';
        }

        const originalUri = vscode.Uri.parse(`claude-diff:${change.filePath}?original`);
        const modifiedUri = vscode.Uri.parse(`claude-diff:${change.filePath}?modified`);

        this.pendingChanges.set(change.filePath, change);

        const diffTitle = `${path.basename(change.filePath)} (Proposed Changes)`;
        
        await vscode.commands.executeCommand(
            'vscode.diff',
            originalUri,
            modifiedUri,
            diffTitle,
            { preview: true }
        );
    }

    async applyChange(filePath: string, code: string): Promise<boolean> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return false;
        }

        const fullPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(workspaceFolder, filePath);

        try {
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const fileExists = fs.existsSync(fullPath);
            
            if (fileExists) {
                const result = await vscode.window.showWarningMessage(
                    `Overwrite ${path.basename(fullPath)}?`,
                    { modal: true },
                    'Yes',
                    'No'
                );
                if (result !== 'Yes') {
                    return false;
                }
            }

            fs.writeFileSync(fullPath, code, 'utf8');

            const doc = await vscode.workspace.openTextDocument(fullPath);
            await vscode.window.showTextDocument(doc);

            vscode.window.showInformationMessage(
                fileExists 
                    ? `Updated: ${path.basename(fullPath)}`
                    : `Created: ${path.basename(fullPath)}`
            );

            return true;
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to apply changes: ${err}`);
            return false;
        }
    }

    async insertAtCursor(code: string): Promise<boolean> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return false;
        }

        await editor.edit(editBuilder => {
            if (editor.selection.isEmpty) {
                editBuilder.insert(editor.selection.active, code);
            } else {
                editBuilder.replace(editor.selection, code);
            }
        });

        return true;
    }

    async replaceSelection(code: string): Promise<boolean> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return false;
        }

        if (editor.selection.isEmpty) {
            const result = await vscode.window.showWarningMessage(
                'No text selected. Insert at cursor?',
                'Yes',
                'No'
            );
            if (result !== 'Yes') {
                return false;
            }
        }

        await editor.edit(editBuilder => {
            editBuilder.replace(editor.selection, code);
        });

        return true;
    }

    getPendingChange(filePath: string): CodeChange | undefined {
        return this.pendingChanges.get(filePath);
    }

    clearPendingChange(filePath: string): void {
        this.pendingChanges.delete(filePath);
    }
}
