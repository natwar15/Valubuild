import firebaseSecurityRules from '@firebase/eslint-plugin-security-rules';

export default [
  {
    files: ['**/*.rules'],
    plugins: {
      '@firebase/security-rules': firebaseSecurityRules,
    },
    language: '@firebase/security-rules/firestore',
    rules: {
      ...firebaseSecurityRules.configs.recommended.rules,
    },
  },
];
