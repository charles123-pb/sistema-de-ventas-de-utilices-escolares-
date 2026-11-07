import { test, expect } from '@playwright/test';
test('menú flotante conserva modo compacto y permite navegar y cerrar en móvil',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/login');await page.getByLabel('Usuario',{exact:true}).fill('administrador');await page.getByLabel('Contraseña',{exact:true}).fill('prueba-segura-123');await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Tu librería, de un vistazo'})).toBeVisible();
 await page.screenshot({path:'../backend/data/exposicion/sidebar-flotante.png',fullPage:true});
 await page.getByRole('button',{name:'Contraer menú',exact:true}).click();await expect(page.locator('.workspace')).toHaveClass(/sidebar-collapsed/);await expect(page.getByRole('button',{name:'Expandir menú',exact:true})).toBeVisible();
 await expect.poll(async()=>Math.round((await page.locator('#personal-sidebar').boundingBox())!.width)).toBe(84);
 await page.reload();await expect(page.getByRole('button',{name:'Expandir menú',exact:true})).toBeVisible();await expect(page.locator('.workspace')).toHaveClass(/sidebar-collapsed/);
 await page.screenshot({path:'../backend/data/exposicion/sidebar-compacto.png',fullPage:true});
 await page.getByRole('button',{name:'Gestión',exact:true}).click();await expect(page.locator('.workspace')).not.toHaveClass(/sidebar-collapsed/);await page.getByRole('link',{name:'Clientes',exact:true}).click();await expect(page).toHaveURL(/\/app\/clientes$/);
 await page.getByRole('button',{name:'Contraer menú',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Abrir menú',exact:true}).click();await expect(page.getByRole('button',{name:'Gestión',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Listas escolares',exact:true}).click();await expect(page.locator('#menu-gestion')).toBeHidden();await expect(page.getByRole('link',{name:'Pedidos',exact:true})).toBeVisible();
 await page.screenshot({path:'../backend/data/exposicion/sidebar-movil.png',fullPage:true});
 await page.getByRole('link',{name:'Pedidos',exact:true}).click();await expect(page.getByRole('button',{name:'Abrir menú',exact:true})).toHaveAttribute('aria-expanded','false');await expect(page.locator('#personal-sidebar')).toBeHidden();
 await page.getByRole('button',{name:'Abrir menú',exact:true}).click();await page.getByRole('button',{name:'Listas escolares',exact:true}).focus();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Abrir menú',exact:true})).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
