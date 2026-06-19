<?php

namespace App\Http\Requests\SuperAdmin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSchoolRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $schoolId = $this->route('school')->id;

        return [
            'name'      => ['required', 'string', 'max:255'],
            'code'      => ['required', 'string', 'max:20', Rule::unique('schools', 'code')->ignore($schoolId)],
            'head_name' => ['nullable', 'string', 'max:255'],
        ];
    }
}
