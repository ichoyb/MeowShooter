// Independent component states. This file is never imported by the player entry.
import {courtyardButton,courtyardNotice,courtyardHeader,courtyardTabs,courtyardStat,courtyardBadge} from '../../src/ui/courtyard-components';

document.getElementById('page-scroll')!.innerHTML=
 courtyardHeader('公共组件','back','示例数据 · 仅展示组件状态，不改变真实游戏')+
 `<section class="court-card fixture-section"><h2>按钮与选择</h2>${courtyardButton('demo','确认出战',{kind:'gold'})}${courtyardButton('demo','次要操作')}${courtyardButton('demo','已选中',{pressed:true})}${courtyardButton('demo','尚未开放',{disabled:true})}</section>`+
 `<section class="court-card fixture-section"><h2>分类标签</h2>${courtyardTabs([{value:'猫咪',label:'猫咪'},{value:'武器',label:'武器'}],'猫咪','fixture-tab')}</section>`+
 `<section class="court-card fixture-section"><h2>状态与属性行</h2>${courtyardBadge('已选中','selected')}${courtyardBadge('锁定','locked')}${courtyardStat('属性名称','示例值')}${courtyardStat('长名称与长数值换行','用于核对小屏幕下文本仍然完整可读')}</section>`+
 courtyardNotice('示例提示：预览配置只会在确认后生效。')+
 courtyardNotice('示例错误：当前配对不可提交，请返回选择。','error')+
 '<p id="fixture-message" role="status">键盘Tab可查看焦点；禁用按钮不会响应。</p>';
document.getElementById('page-footer')!.innerHTML=courtyardButton('demo','确认操作',{kind:'gold'});
document.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');if(!button||button.disabled)return;document.getElementById('fixture-message')!.textContent='示例数据：已点击「'+button.textContent!.trim()+'」，不改变真实游戏。';});
