import { doc, setDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase.ts';

async function bootstrapAdmin() {
  const adminEmail = process.argv[2] || 'iwatech1285@gmail.com';
  const role = process.argv[3] || 'superadmin';

  console.log(`🚀 Bootstrapping admin account for: ${adminEmail} (Role: ${role})...`);

  try {
    const adminId = adminEmail.replace(/[@.]/g, '_');
    await setDoc(doc(db, 'admin_users', adminId), {
      email: adminEmail,
      role,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    console.log(`✅ Admin ${adminEmail} successfully configured in Firestore /admin_users/${adminId}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to bootstrap admin:', err);
    process.exit(1);
  }
}

bootstrapAdmin();
