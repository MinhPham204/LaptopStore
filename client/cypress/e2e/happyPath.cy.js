describe('Luồng Happy Path từ Đăng nhập đến Đặt hàng thành công (COD)', () => {
  const baseUrl = 'http://localhost:3000';
  const testUser = 'kiet9';
  const testPass = '123123';

  // Thiết lập session đăng nhập để tái sử dụng giữa các khối it() độc lập
  beforeEach(() => {
    cy.session(testUser, () => {
      cy.visit(`${baseUrl}/login`);
      
      // Khai báo intercept kiểm tra API đăng nhập thành công
      cy.intercept('POST', '**/api/auth/login').as('loginRequest');

    cy.get('input[name="username"]').type(testUser);

    // 	Điền mật khẩu (Tương tự cho ô password)
    cy.get('input[name="password"]').type(testPass);
      
      // Click nút Đăng nhập
      cy.contains('button', 'Đăng nhập').click();

      // Đợi API login phản hồi thành công trước khi lưu session
      cy.wait('@loginRequest');
      cy.url().should('not.include', '/login');
    });
  });

  it('Bước 1: Tìm kiếm Laptop từ Trang chủ', () => {
  cy.visit(baseUrl);

  // Bỏ cy.intercept() ở đây nếu không cần thiết

  // Tìm ô nhập dữ liệu tìm kiếm tại Header và thực hiện search
  cy.get('input[name="search"], input[id="search-input"], input[placeholder*="Tìm kiếm"]').first()
    .should('be.visible')
    .type('Laptop{enter}');

  // 1. Kiểm tra URL đã thay đổi chính xác chứa tham số tìm kiếm
  cy.url().should('include', '?search=Laptop');

  cy.contains('Lenovo ThinkPad').should('be.visible');
});

  it('Bước 2: Truy cập trang chi tiết của sản phẩm đầu tiên', () => {
    cy.visit(baseUrl);
    
    // Tìm và click vào sản phẩm đầu tiên xuất hiện trong danh sách
    // Thường sử dụng cấu trúc component ProductCard
cy.contains('Lenovo ThinkPad').first().click({ force: true });
    // Kiểm tra đã chuyển hướng thành công sang trang chi tiết sản phẩm
    cy.url().should('include', '/products/');
    cy.contains('button', 'Thêm vào giỏ').should('be.visible');
  });

  it('Bước 3: Thêm sản phẩm vào giỏ hàng và di chuyển tới trang Giỏ Hàng', () => {
  cy.visit(baseUrl);

  // 1. Thực hiện gõ tìm kiếm lại để danh sách sản phẩm hiển thị
  cy.get('input[name="search"], input[id="search-input"], input[placeholder*="Tìm kiếm"]').first().type('Laptop{enter}');

  // 2. Click vào sản phẩm Lenovo ThinkPad đầu tiên tìm thấy
  cy.contains('Lenovo ThinkPad').first().click({ force: true });

  // 3. Đợi chuyển hướng vào trang chi tiết sản phẩm thành công
  cy.url().should('include', '/products/');

  // 4. Click chọn nút "Thêm vào giỏ hàng" bằng chữ hiển thị trên màn hình
  cy.contains('button', 'Thêm vào giỏ').should('be.visible').click();

  // 5. Di chuyển tới trang Giỏ hàng để chuẩn bị checkout
  cy.visit(`${baseUrl}/cart`);
  cy.url().should('include', '/cart');
});

it('Bước 4: Điền thông tin giao hàng và đặt hàng COD', () => {
  cy.visit(`${baseUrl}/cart`);
  
  // Tick checkbox sản phẩm và vào checkout
  cy.get('input[type="checkbox"]').first().check({ force: true });
  cy.contains('button', /Tiến hành đặt hàng|Thanh toán|Mua hàng/).click();
  cy.url().should('include', '/checkout');

  // 1. Điền địa chỉ chi tiết (BẮTBUỘC — address không tự điền)
  cy.get('input[name="address"]').should('be.disabled'); // disabled cho đến khi chọn tỉnh + ward
  
  // 2. Chọn Tỉnh/Thành — dùng option value thực tế
  cy.get('select[name="city"]').find('option').eq(1).then(opt => {
    cy.get('select[name="city"]').select(opt.val());
  });

  // 3. Đợi API load danh sách ward + geocode tỉnh
  cy.wait(2000);

  // 4. Chọn Phường/Xã
  cy.get('select[name="ward"]').should('not.be.disabled');
  cy.get('select[name="ward"]').find('option').eq(1).then(opt => {
    cy.get('select[name="ward"]').select(opt.val());
  });

  // 5. Đợi geocode ward xong (gọi Nominatim) → marker tự set trên map
  cy.wait(3000);

  // 6. Điền địa chỉ chi tiết (lúc này input đã enabled)
  cy.get('input[name="address"]').should('not.be.disabled').type('97 Man Thiện');

  // 7. Blur ra ngoài để trigger geocode address
  cy.get('input[name="address"]').blur();
  cy.wait(2000);

  // 8. Bấm "Xác nhận vị trí" trong MapPicker — BẮT BUỘC để locationConfirmed = true
  cy.contains('button', 'Xác nhận vị trí').should('be.visible').click();

  // 9. COD là mặc định rồi — không cần chọn thêm

  // 10. Nút "Đặt hàng" lúc này mới enabled
  cy.contains('button', 'Đặt hàng').should('not.be.disabled').click();

  // 11. Kiểm tra redirect thành công
  cy.url().should('include', '/checkout/success');
  cy.contains('Đặt hàng thành công!').should('be.visible');
});
});