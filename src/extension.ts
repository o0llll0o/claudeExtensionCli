import * as vscode from 'vscode';
import { ClaudeService } from './engine/ClaudeService';
import { ChatViewProvider } from './providers/ChatViewProvider';

let claudeService: ClaudeService | undefined;

export function activate(context: vscode.ExtensionContext) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    
    claudeService = new ClaudeService(workspaceFolder);
    
    const chatProvider = new ChatViewProvider(context.extensionUri, claudeService, workspaceFolder);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('claudeAssistant.chatView', chatProvider)
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeAssistant.openChat', () => {
            vscode.commands.executeCommand('claudeAssistant.chatView.focus');
        })
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('claudeAssistant.stopGeneration', () => {
            claudeService?.stop();
        })
    );
    
    context.subscriptions.push({
        dispose: () => {
            claudeService?.dispose();
        }
    });
}

export function deactivate() {
    claudeService?.dispose();
}
