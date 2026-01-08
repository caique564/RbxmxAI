
import { RobloxAsset } from '../types';

/**
 * Construtor robusto de XML do Roblox (.rbxmx)
 * Gera estruturas que podem ser arrastadas diretamente para o Roblox Studio.
 */
export const buildRbxmx = (asset: RobloxAsset): string => {
  const escapeXml = (unsafe: string) => {
    if (!unsafe) return "";
    return unsafe.replace(/[<>&"']/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '"': return '&quot;';
        case "'": return '&apos;';
        default: return c;
      }
    });
  };

  const generateItem = (item: RobloxAsset, depth: number = 0): string => {
    const indent = '  '.repeat(depth + 1);
    const referent = `RBX${Math.floor(Math.random() * 100000000)}`;
    
    let xml = `${indent}<Item class="${item.className}" referent="${referent}">\n`;
    xml += `${indent}  <Properties>\n`;
    xml += `${indent}    <string name="Name">${escapeXml(item.name)}</string>\n`;

    // Trata código de Scripts usando ProtectedString e CDATA
    if (item.source && (item.className.includes('Script') || item.className === 'ModuleScript')) {
      xml += `${indent}    <ProtectedString name="Source"><![CDATA[${item.source}]]></ProtectedString>\n`;
    }

    // Adiciona propriedades extras se existirem
    if (item.properties) {
      Object.entries(item.properties).forEach(([name, value]) => {
        if (typeof value === 'string') {
          xml += `${indent}    <string name="${name}">${escapeXml(value)}</string>\n`;
        } else if (typeof value === 'number') {
          xml += `${indent}    <float name="${name}">${value}</float>\n`;
        } else if (typeof value === 'boolean') {
          xml += `${indent}    <bool name="${name}">${value}</bool>\n`;
        }
      });
    }

    xml += `${indent}  </Properties>\n`;

    // Filhos recursivos
    if (item.children && item.children.length > 0) {
      item.children.forEach(child => {
        xml += generateItem(child, depth + 1);
      });
    }

    xml += `${indent}</Item>\n`;
    return xml;
  };

  let fullXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  fullXml += '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">\n';
  fullXml += '  <External>null</External>\n';
  fullXml += '  <External>nil</External>\n';
  fullXml += generateItem(asset);
  fullXml += '</roblox>';

  return fullXml;
};

/**
 * Função simples para parsear XML básico (usada para análise de arquivos subidos)
 */
export const parseRbxmx = (xmlText: string): RobloxAsset => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const rootItem = xmlDoc.querySelector("Item");

  const extractItem = (element: Element): RobloxAsset => {
    const className = element.getAttribute("class") || "Folder";
    const nameNode = element.querySelector('Properties > string[name="Name"]');
    const sourceNode = element.querySelector('Properties > ProtectedString[name="Source"]');
    
    const children: RobloxAsset[] = [];
    const childItems = element.children;
    for (let i = 0; i < childItems.length; i++) {
      if (childItems[i].tagName === "Item") {
        children.push(extractItem(childItems[i]));
      }
    }

    return {
      id: crypto.randomUUID(),
      name: nameNode?.textContent || "Unnamed",
      className: className,
      source: sourceNode?.textContent || undefined,
      children: children
    };
  };

  if (!rootItem) throw new Error("Arquivo XML inválido ou sem itens Roblox.");
  return extractItem(rootItem);
};
