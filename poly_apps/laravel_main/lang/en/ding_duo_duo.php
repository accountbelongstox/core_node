<?php

return [
    'super_code_mint_invalid' => 'A super code needs a device id and a future expiry.',
    'super_code_key_missing' => 'The super code signing seed :name is not installed; run dd.sh or dd.cmd to decrypt the secret store.',
    'super_code_key_mismatch' => 'The super code signing seed :name does not match service_contract.json dingdoudou.super_code_public_key.',
    'super_code_minted' => 'Super code for device :device (expires :expires):',
];
