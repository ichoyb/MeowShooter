// Independent error UI remains available when the engine bundle itself cannot load.
import { bindActionInput } from './ui/action-input';
(function () {
  function fail(message) {
    document.getElementById('error-message').textContent = message;
    document.getElementById('error').hidden = false;
  }
  window.GameBoot = { fail: fail };
  window.addEventListener('error', function (event) {
    var node = event.target;
    if (node && node.id === 'game-script') fail('游戏脚本没有加载成功，请重新加载。');
    else if (event.message) fail('游戏暂时无法运行，请重新加载并记录使用环境。');
  }, true);
  window.addEventListener('unhandledrejection', function () { fail('资源准备失败，请重新加载。'); });
  bindActionInput(document, '#retry', function () { window.location.reload(); });
}());
