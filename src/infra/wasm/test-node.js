const wasm = require('./pkg-node/zukan_wasm.js');

(async () => {
  // nodejs 目标自动初始化
  wasm.init();
  console.log('✅ WASM 初始化成功\n');

  // 测试 1: SHA-256
  const hash = wasm.sha256_hash('hello');
  const expected = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
  console.log('SHA-256("hello"):', hash);
  console.log('  期望:', expected);
  console.log('  结果:', hash === expected ? '✅ 通过' : '❌ 失败');

  // 测试 2: AES-256-GCM 加解密
  const key = wasm.generate_key();
  const plaintext = 'Hello, Pokémon!';
  const encrypted = wasm.encrypt(key, plaintext);
  const decrypted = wasm.decrypt(key, encrypted);
  console.log('\nAES-256-GCM:');
  console.log('  密钥:', key.slice(0, 20) + '...');
  console.log('  明文:', plaintext);
  console.log('  密文:', encrypted.slice(0, 20) + '...');
  console.log('  解密:', decrypted);
  console.log('  结果:', decrypted === plaintext ? '✅ 通过' : '❌ 失败');

  // 测试 3: HMAC
  const sig = wasm.hmac_sign('secret', 'test data');
  const valid = wasm.hmac_verify('secret', 'test data', sig);
  const invalid = wasm.hmac_verify('secret', 'wrong', sig);
  console.log('\nHMAC-SHA256:');
  console.log('  签名:', sig.slice(0, 20) + '...');
  console.log('  正确验证:', valid ? '✅ 通过' : '❌ 失败');
  console.log('  错误验证:', !invalid ? '✅ 通过' : '❌ 失败');

  // 测试 4: 伤害计算
  const input = new wasm.DamageInput(50, 120, 100, 80, 150, 200, 0);
  const damage = wasm.calculate_damage(input);
  console.log('\n伤害计算 (Lv50 Atk120 vs Def100, 威力80, STAB, 2x克制):');
  console.log('  单次伤害:', damage);

  // 测试 5: 批量伤害范围
  const batch = wasm.calculate_damage_batch(input);
  const rolls = batch.get_rolls(input);
  console.log('  伤害范围:', batch.min, '-', batch.max);
  console.log('  平均伤害:', batch.average.toFixed(1));
  console.log('  随机值:', Array.from(rolls));

  // 测试 6: HP 计算
  // HP = floor((2*Base + IV + EV/4) * Level / 100) + Level + 10
  // = floor((200 + 31 + 63) * 50 / 100) + 50 + 10 = 147 + 60 = 207
  const hp = wasm.calculate_hp(50, 100, 31, 252);
  console.log('\nHP 计算 (Lv50 种族100 IV31 EV252):');
  console.log('  HP:', hp, hp === 207 ? '✅ 通过' : '❌ 期望 207');

  // 测试 7: 性格修正
  const nature = wasm.calculate_nature_mod(3); // Adamant +Atk -SpA
  const natureArr = Array.from(nature);
  console.log('\n性格修正 (ID=3 Adamant):');
  console.log('  [atk, def, spa, spd, spe]:', natureArr);
  console.log('  结果:', natureArr[0] === 110 && natureArr[2] === 90 ? '✅ 通过' : '❌ 失败');

  console.log('\n========== 所有测试完成 ==========');
})().catch(e => {
  console.error('❌ 测试失败:', e);
  process.exit(1);
});
